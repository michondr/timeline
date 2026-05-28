<?php

namespace App\Message;

/** Dispatched to sync TickTick habits for a specific user. */
class SyncTickTickMessage
{
    public function __construct(public readonly string $userId) {}
}
