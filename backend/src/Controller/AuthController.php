<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/auth', name: 'api_auth_')]
class AuthController extends AbstractController
{
    public function __construct(
        private readonly string $rpId,
        private readonly string $rpName,
    ) {}

    // ── Passkey challenge endpoints ───────────────────────────────────────────

    /**
     * Returns a random WebAuthn challenge + RP info for navigator.credentials.get().
     */
    #[Route('/passkey/login/challenge', name: 'passkey_login_challenge', methods: ['POST'])]
    public function passkeyLoginChallenge(): JsonResponse
    {
        return $this->json([
            'challenge' => $this->b64url(random_bytes(32)),
            'rpId'      => $this->rpId,
            'timeout'   => 120_000,
        ]);
    }

    /**
     * Receives the userHandle from a WebAuthn assertion.
     * Returns kdfSalt + verificationBlob if user exists, or 404 with the userHandle for registration.
     *
     * We do not verify the WebAuthn signature here — the passphrase (authKeyHex) is the
     * cryptographic proof of identity. WebAuthn is used only to retrieve the userHandle
     * without requiring the user to type any identifier.
     */
    #[Route('/passkey/login/verify', name: 'passkey_login_verify', methods: ['POST'])]
    public function passkeyLoginVerify(Request $request, UserRepository $repo): JsonResponse
    {
        $data       = json_decode($request->getContent(), true);
        $userHandle = trim($data['userHandle'] ?? '');

        if (!$userHandle) {
            return $this->json(['error' => 'userHandle is required'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user = $repo->findByUserHandle($userHandle);

        if (!$user) {
            return $this->json(['found' => false, 'userHandle' => $userHandle], Response::HTTP_NOT_FOUND);
        }

        return $this->json([
            'found'            => true,
            'userHandle'       => $userHandle,
            'kdfSalt'          => $user->getKdfSalt(),
            'verificationBlob' => $user->getVerificationBlob(),
        ]);
    }

    /**
     * Returns a random WebAuthn challenge + RP info + a new server-generated userId
     * for navigator.credentials.create(). The userId becomes the permanent userHandle.
     */
    #[Route('/passkey/register/challenge', name: 'passkey_register_challenge', methods: ['POST'])]
    public function passkeyRegisterChallenge(): JsonResponse
    {
        return $this->json([
            'challenge' => $this->b64url(random_bytes(32)),
            'rpId'      => $this->rpId,
            'rpName'    => $this->rpName,
            'userId'    => $this->b64url(random_bytes(32)),
            'timeout'   => 120_000,
        ]);
    }

    /**
     * Creates a new user. The userHandle is the base64url userId from the registration challenge.
     */
    #[Route('/passkey/register/finish', name: 'passkey_register_finish', methods: ['POST'])]
    public function passkeyRegisterFinish(Request $request, UserRepository $repo, EntityManagerInterface $em): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        foreach (['userHandle', 'birthdate', 'kdfSalt', 'verificationBlob', 'authKeyHex'] as $field) {
            if (empty($data[$field])) {
                return $this->json(['error' => "$field is required"], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        if ($repo->findByUserHandle($data['userHandle'])) {
            return $this->json(['error' => 'User already registered'], Response::HTTP_CONFLICT);
        }

        $user = (new User())
            ->setUserHandle($data['userHandle'])
            ->setKdfSalt($data['kdfSalt'])
            ->setVerificationBlob($data['verificationBlob'])
            ->setBirthdate(new \DateTimeImmutable($data['birthdate']))
            ->setAuthKeyHash(password_hash($data['authKeyHex'], PASSWORD_BCRYPT))
            ->setApiToken(bin2hex(random_bytes(32)));

        $em->persist($user);
        $em->flush();

        return $this->json([
            'apiToken'  => $user->getApiToken(),
            'birthdate' => $user->getBirthdate()->format('Y-m-d'),
        ], Response::HTTP_CREATED);
    }

    // ── Passphrase login finish ───────────────────────────────────────────────

    /**
     * Verifies authKeyHex (derived from passphrase), rotates and returns the bearer token.
     */
    #[Route('/login/finish', name: 'login_finish', methods: ['POST'])]
    public function loginFinish(Request $request, UserRepository $repo, EntityManagerInterface $em): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $user = $repo->findByUserHandle(trim($data['userHandle'] ?? ''));

        if (!$user || !password_verify($data['authKeyHex'] ?? '', $user->getAuthKeyHash())) {
            return $this->json(['error' => 'Invalid credentials'], Response::HTTP_UNAUTHORIZED);
        }

        $user->setApiToken(bin2hex(random_bytes(32)));
        $em->flush();

        return $this->json([
            'apiToken'  => $user->getApiToken(),
            'birthdate' => $user->getBirthdate()->format('Y-m-d'),
        ]);
    }

    // ── Authenticated endpoints ───────────────────────────────────────────────

    /** Returns current user's kdfSalt + verificationBlob + birthdate (used in unlock mode). */
    #[Route('/me', name: 'me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        return $this->json([
            'birthdate'        => $user->getBirthdate()->format('Y-m-d'),
            'kdfSalt'          => $user->getKdfSalt(),
            'verificationBlob' => $user->getVerificationBlob(),
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function b64url(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }
}
