<?php

namespace App\Service;

class EncryptionService
{
    private string $key;

    public function __construct(string $appSecret)
    {
        $this->key = hash_hkdf('sha256', $appSecret, 32, 'timeline-field-encryption');
    }

    public function encrypt(string $value): string
    {
        $nonce      = random_bytes(12);
        $tag        = '';
        $ciphertext = openssl_encrypt($value, 'aes-256-gcm', $this->key, OPENSSL_RAW_DATA, $nonce, $tag);

        return base64_encode($nonce . $tag . $ciphertext);
    }

    public function decrypt(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $raw = base64_decode($value, strict: true);
        if ($raw === false || strlen($raw) < 28) {
            return null;
        }

        $nonce      = substr($raw, 0, 12);
        $tag        = substr($raw, 12, 16);
        $ciphertext = substr($raw, 28);

        $result = openssl_decrypt($ciphertext, 'aes-256-gcm', $this->key, OPENSSL_RAW_DATA, $nonce, $tag);

        return $result === false ? null : $result;
    }
}
