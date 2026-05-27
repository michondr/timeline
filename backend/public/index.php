<?php

use App\Kernel;
use Symfony\Component\HttpFoundation\Request;

require_once dirname(__DIR__).'/vendor/autoload.php';

if (file_exists(dirname(__DIR__).'/.env')) {
    (new Symfony\Component\Dotenv\Dotenv())->bootEnv(dirname(__DIR__).'/.env');
}

$env    = $_SERVER['APP_ENV'] ?? 'dev';
$debug  = (bool) ($_SERVER['APP_DEBUG'] ?? ('prod' !== $env));

$kernel   = new Kernel($env, $debug);
$request  = Request::createFromGlobals();
$response = $kernel->handle($request);
$response->send();
$kernel->terminate($request, $response);
