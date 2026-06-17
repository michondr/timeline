<?php

namespace App\Message;

/** Dispatched to write a continuous JSON backup of a specific user's timeline. */
class ExportTimelineMessage
{
    public function __construct(public readonly string $userId) {}
}
