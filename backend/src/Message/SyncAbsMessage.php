<?php

namespace App\Message;

/** Dispatched to sync Audiobookshelf books for a specific user. */
class SyncAbsMessage
{
    public function __construct(public readonly string $userId) {}
}
