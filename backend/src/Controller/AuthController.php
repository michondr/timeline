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
    /**
     * Step 1 of registration: check email availability, return a server-generated KDF salt.
     */
    #[Route('/register/init', name: 'register_init', methods: ['POST'])]
    public function registerInit(Request $request, UserRepository $repo): JsonResponse
    {
        $data  = json_decode($request->getContent(), true);
        $email = trim($data['email'] ?? '');

        if (!$email) {
            return $this->json(['error' => 'email is required'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($repo->findOneBy(['email' => $email])) {
            return $this->json(['error' => 'Email already registered'], Response::HTTP_CONFLICT);
        }

        return $this->json(['kdfSalt' => base64_encode(random_bytes(32))]);
    }

    /**
     * Step 2 of registration: persist the new user and return a bearer token.
     */
    #[Route('/register/finish', name: 'register_finish', methods: ['POST'])]
    public function registerFinish(Request $request, UserRepository $repo, EntityManagerInterface $em): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        foreach (['email', 'birthdate', 'kdfSalt', 'verificationBlob', 'authKeyHex'] as $field) {
            if (empty($data[$field])) {
                return $this->json(['error' => "$field is required"], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        if ($repo->findOneBy(['email' => $data['email']])) {
            return $this->json(['error' => 'Email already registered'], Response::HTTP_CONFLICT);
        }

        $user = (new User())
            ->setEmail($data['email'])
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

    /**
     * Step 1 of login: return the KDF salt and verification blob for the given email.
     */
    #[Route('/login/init', name: 'login_init', methods: ['POST'])]
    public function loginInit(Request $request, UserRepository $repo): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $user = $repo->findOneBy(['email' => trim($data['email'] ?? '')]);

        if (!$user) {
            // Constant-time-ish response to avoid user enumeration
            return $this->json(['error' => 'Invalid credentials'], Response::HTTP_UNAUTHORIZED);
        }

        return $this->json([
            'kdfSalt'          => $user->getKdfSalt(),
            'verificationBlob' => $user->getVerificationBlob(),
        ]);
    }

    /**
     * Step 2 of login: verify the derived auth key, rotate and return a bearer token.
     */
    #[Route('/login/finish', name: 'login_finish', methods: ['POST'])]
    public function loginFinish(Request $request, UserRepository $repo, EntityManagerInterface $em): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $user = $repo->findOneBy(['email' => trim($data['email'] ?? '')]);

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

    /** Current user info (requires auth). */
    #[Route('/me', name: 'me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        /** @var \App\Entity\User $user */
        $user = $this->getUser();
        return $this->json([
            'email'     => $user->getUserIdentifier(),
            'birthdate' => $user->getBirthdate()->format('Y-m-d'),
        ]);
    }
}
