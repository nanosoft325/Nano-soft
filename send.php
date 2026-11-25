<?php
declare(strict_types=1);

/* Public contact endpoint. Secrets are supplied through PHP environment variables. */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$siteOrigin = rtrim((string)(getenv('NANOSOFT_SITE_ORIGIN') ?: 'https://nanosoft.team'), '/');
$originParts = parse_url($siteOrigin);
if (!$originParts || empty($originParts['scheme']) || empty($originParts['host'])) {
    respond(500, ['ok' => false, 'error' => 'Сервис временно недоступен']);
}
if (strtolower((string)$originParts['scheme']) !== 'https') {
    respond(500, ['ok' => false, 'error' => 'Сервис временно недоступен']);
}
$port = isset($originParts['port']) && (int)$originParts['port'] !== 443 ? ':' . (int)$originParts['port'] : '';
$expectedOrigin = strtolower('https://' . $originParts['host'] . $port);
$requestOrigin = strtolower(rtrim((string)($_SERVER['HTTP_ORIGIN'] ?? ''), '/'));
$fetchSite = strtolower((string)($_SERVER['HTTP_SEC_FETCH_SITE'] ?? ''));

if ($method === 'GET' && ($_GET['csrf'] ?? '') !== '1') {
    respond(404, ['ok' => false, 'error' => 'Не найдено']);
}
if ($method !== 'GET' && $method !== 'POST') {
    header('Allow: GET, POST');
    respond(405, ['ok' => false, 'error' => 'Метод не поддерживается']);
}
if ($method === 'POST' && ($requestOrigin === '' || !hash_equals($expectedOrigin, $requestOrigin))) {
    respond(403, ['ok' => false, 'error' => 'Запрос отклонен']);
}
if ($requestOrigin !== '' && !hash_equals($expectedOrigin, $requestOrigin)) {
    respond(403, ['ok' => false, 'error' => 'Запрос отклонен']);
}
if ($fetchSite !== '' && !in_array($fetchSite, ['same-origin', 'none'], true)) {
    respond(403, ['ok' => false, 'error' => 'Запрос отклонен']);
}

session_name('nanosoft_contact');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.use_trans_sid', '0');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict',
]);
if (!session_start()) {
    respond(503, ['ok' => false, 'error' => 'Сервис временно недоступен']);
}

if ($method === 'GET' && ($_GET['csrf'] ?? '') === '1') {
    if (empty($_SESSION['contact_csrf'])) {
        $_SESSION['contact_csrf'] = bin2hex(random_bytes(32));
        $_SESSION['contact_issued_at'] = time();
    }
    header('Cache-Control: no-store');
    respond(200, ['ok' => true, 'csrf_token' => $_SESSION['contact_csrf']]);
}
if ($method !== 'POST') {
    respond(404, ['ok' => false, 'error' => 'Не найдено']);
}

$contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
if (strpos($contentType, 'multipart/form-data') !== 0) {
    respond(415, ['ok' => false, 'error' => 'Неподдерживаемый формат запроса']);
}
$maxFileSize = 10 * 1024 * 1024;
$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > $maxFileSize + 1024 * 1024) {
    respond(413, ['ok' => false, 'error' => 'Размер запроса слишком большой']);
}
$csrf = is_string($_POST['csrf_token'] ?? null) ? (string)$_POST['csrf_token'] : '';
if ($csrf === '' || empty($_SESSION['contact_csrf']) || !hash_equals((string)$_SESSION['contact_csrf'], $csrf)) {
    respond(403, ['ok' => false, 'error' => 'Обновите страницу и отправьте форму снова']);
}
$issuedAt = (int)($_SESSION['contact_issued_at'] ?? 0);
if ($issuedAt <= 0 || time() - $issuedAt > 14400) {
    unset($_SESSION['contact_csrf'], $_SESSION['contact_issued_at']);
    respond(403, ['ok' => false, 'error' => 'Обновите страницу и отправьте форму снова']);
}

$honeypot = is_string($_POST['website_hp'] ?? null) ? trim($_POST['website_hp']) : '';
if ($honeypot !== '') {
    respond(200, ['ok' => true, 'filtered' => true]);
}
$elapsed = time() - $issuedAt;
if ($elapsed < 2) {
    respond(429, ['ok' => false, 'error' => 'Подождите немного и отправьте форму снова']);
}

function allow_contact_request(string $remoteAddress): bool
{
    $key = hash('sha256', $remoteAddress !== '' ? $remoteAddress : 'unknown');
    $storePath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'nanosoft-contact-rate-v1-' . substr(hash('sha256', __DIR__), 0, 16) . '.json';
    if (is_link($storePath)) {
        return false;
    }
    $handle = @fopen($storePath, 'c+');
    if ($handle === false) {
        return false;
    }
    @chmod($storePath, 0600);
    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        return false;
    }
    rewind($handle);
    $raw = stream_get_contents($handle);
    $buckets = json_decode(is_string($raw) ? $raw : '', true);
    if (!is_array($buckets)) {
        $buckets = [];
    }
    $now = time();
    foreach ($buckets as $bucketKey => $events) {
        if (!is_array($events)) {
            unset($buckets[$bucketKey]);
            continue;
        }
        $events = array_values(array_filter($events, static function ($event) use ($now): bool {
            return is_int($event) && $event > $now - 3600;
        }));
        if ($events) {
            $buckets[$bucketKey] = $events;
        } else {
            unset($buckets[$bucketKey]);
        }
    }
    $events = $buckets[$key] ?? [];
    if (count($events) >= 5 || (count($buckets) >= 5000 && !isset($buckets[$key]))) {
        flock($handle, LOCK_UN);
        fclose($handle);
        return false;
    }
    $events[] = $now;
    $buckets[$key] = $events;
    rewind($handle);
    ftruncate($handle, 0);
    $written = fwrite($handle, json_encode($buckets));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return $written !== false;
}

$remoteAddress = (string)($_SERVER['REMOTE_ADDR'] ?? '');
if ($remoteAddress === '' || !allow_contact_request($remoteAddress)) {
    respond(429, ['ok' => false, 'error' => 'Слишком много заявок. Попробуйте позже']);
}
session_write_close();

function post_text(string $key, string $fallback, int $maxLength): string
{
    $value = $_POST[$key] ?? $fallback;
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) {
        return '';
    }
    $value = trim(strip_tags($value));
    $value = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $value) ?? '';
    return mb_substr(trim($value), 0, $maxLength, 'UTF-8');
}

$name = post_text('name', '', 120);
$company = post_text('company', 'Не указана', 160);
$contact = post_text('contact', '', 160);
$channel = post_text('channel', 'Telegram', 40);
$service = post_text('service', 'Общий запрос', 200);
$task = post_text('task', '', 3000);
if ($name === '' || $contact === '') {
    respond(400, ['ok' => false, 'error' => 'Заполните имя и контактные данные']);
}
if (($_POST['privacy_consent'] ?? '') !== '1') {
    respond(400, ['ok' => false, 'error' => 'Необходимо согласие на обработку данных']);
}

$refererPath = '/';
$referer = (string)($_SERVER['HTTP_REFERER'] ?? '');
$refererParts = parse_url($referer);
if ($refererParts && isset($refererParts['host']) && strtolower($refererParts['host']) === strtolower($originParts['host'])) {
    $refererPath = (string)($refererParts['path'] ?? '/');
    if ($refererPath === '' || $refererPath[0] !== '/' || strpos($refererPath, "\r") !== false || strpos($refererPath, "\n") !== false) {
        $refererPath = '/';
    }
}

$filePath = '';
$fileName = '';
$fileType = '';
$hasFile = false;
if (isset($_FILES['attachment']) && is_array($_FILES['attachment'])) {
    $upload = $_FILES['attachment'];
    $uploadError = (int)($upload['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($uploadError !== UPLOAD_ERR_NO_FILE) {
        if ($uploadError !== UPLOAD_ERR_OK || empty($upload['tmp_name']) || !is_uploaded_file((string)$upload['tmp_name'])) {
            respond(400, ['ok' => false, 'error' => 'Не удалось принять файл']);
        }
        $rawName = basename((string)($upload['name'] ?? ''));
        $extension = strtolower((string)pathinfo($rawName, PATHINFO_EXTENSION));
        $allowedTypes = [
            'pdf' => ['application/pdf'],
            'docx' => ['application/zip', 'application/x-zip', 'application/octet-stream', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            'zip' => ['application/zip', 'application/x-zip', 'application/octet-stream'],
        ];
        $fileSize = (int)filesize((string)$upload['tmp_name']);
        if (!isset($allowedTypes[$extension]) || $fileSize <= 0 || $fileSize > $maxFileSize) {
            respond(400, ['ok' => false, 'error' => 'Разрешены PDF, DOCX и ZIP размером до 10 МБ']);
        }
        if (!class_exists('finfo')) {
            respond(503, ['ok' => false, 'error' => 'Проверка файлов временно недоступна']);
        }
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $detectedType = (string)$finfo->file((string)$upload['tmp_name']);
        if (!in_array($detectedType, $allowedTypes[$extension], true)) {
            respond(400, ['ok' => false, 'error' => 'Содержимое файла не соответствует его формату']);
        }
        $signature = (string)file_get_contents((string)$upload['tmp_name'], false, null, 0, 8);
        if (($extension === 'pdf' && strpos($signature, '%PDF-') !== 0) || (in_array($extension, ['docx', 'zip'], true) && substr($signature, 0, 2) !== 'PK')) {
            respond(400, ['ok' => false, 'error' => 'Содержимое файла не соответствует его формату']);
        }
        $fileName = preg_replace('/[^a-zA-Zа-яА-Я0-9._ -]/u', '_', $rawName) ?? 'attachment.' . $extension;
        $fileName = mb_substr($fileName, 0, 100, 'UTF-8');
        $fileName = str_replace(['"', "'", '\\'], '_', $fileName);
        $mimeByExtension = [
            'pdf' => 'application/pdf',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'zip' => 'application/zip',
        ];
        $fileType = $mimeByExtension[$extension];
        $filePath = (string)$upload['tmp_name'];
        $hasFile = true;
    }
}

$tgBotToken = trim((string)getenv('TELEGRAM_BOT_TOKEN'));
$tgChatId = trim((string)getenv('TELEGRAM_CHAT_ID'));
$notifyEmail = trim((string)(getenv('CONTACT_NOTIFY_EMAIL') ?: 'info@nanosoft-team.ru'));
$tgSent = false;
$tgConfigured = $tgBotToken !== '' && $tgChatId !== '';

$escape = static function (string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
};
$tgText = "🔥 <b>Новая заявка с сайта nanosoft.team</b>\n\n";
$tgText .= "👤 <b>Имя:</b> " . $escape($name) . "\n";
$tgText .= "🏢 <b>Компания:</b> " . $escape($company) . "\n";
$tgText .= "📞 <b>Контакт:</b> <code>" . $escape($contact) . "</code>\n";
$tgText .= "💬 <b>Где ждет ответ:</b> " . $escape($channel) . "\n";
$tgText .= "🎯 <b>Направление:</b> " . $escape($service) . "\n";
$tgText .= "📝 <b>Задача / Расчет:</b>\n" . $escape($task) . "\n\n";
$tgText .= "🌐 <b>Страница:</b> " . $escape($siteOrigin . $refererPath);

$sendTelegram = static function (string $methodName, array $fields) use ($tgBotToken): bool {
    if ($tgBotToken === '' || !function_exists('curl_init')) {
        return false;
    }
    $handle = curl_init('https://api.telegram.org/bot' . $tgBotToken . '/' . $methodName);
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_POSTFIELDS => $fields,
    ]);
    $response = curl_exec($handle);
    $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    if (!is_string($response) || $status < 200 || $status >= 300) {
        return false;
    }
    $decoded = json_decode($response, true);
    return is_array($decoded) && ($decoded['ok'] ?? false) === true;
};

if ($tgConfigured) {
    $tgSent = $sendTelegram('sendMessage', [
        'chat_id' => $tgChatId,
        'text' => $tgText,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true,
    ]);
    if ($tgSent && $hasFile) {
        $caption = 'Файл ТЗ к заявке от ' . $name . ' (' . $company . ')';
        $sentDocument = $sendTelegram('sendDocument', [
            'chat_id' => $tgChatId,
            'document' => new CURLFile($filePath, $fileType, $fileName),
            'caption' => mb_substr($caption, 0, 900, 'UTF-8'),
        ]);
        $tgSent = $tgSent && $sentDocument;
    }
}

$emailSent = false;
if (filter_var($notifyEmail, FILTER_VALIDATE_EMAIL)) {
    $subjectText = 'Заявка с сайта nanosoft.team: ' . $name . ' (' . $company . ')';
    $subject = '=?UTF-8?B?' . base64_encode($subjectText) . '?=';
    $plainBody = "Имя: {$name}\nКомпания: {$company}\nКонтакт: {$contact}\nСпособ связи: {$channel}\nНаправление: {$service}\n\nЗадача / Расчет:\n{$task}\n\nСтраница: {$siteOrigin}{$refererPath}\n";
    $headers = "From: no-reply@nanosoft.team\r\nReply-To: {$notifyEmail}\r\nMIME-Version: 1.0\r\n";
    if ($hasFile && is_readable($filePath)) {
        $boundary = 'ns_' . bin2hex(random_bytes(16));
        $headers .= "Content-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n";
        $encodedName = '=?UTF-8?B?' . base64_encode($fileName) . '?=';
        $encodedFile = chunk_split(base64_encode((string)file_get_contents($filePath)));
        $emailMessage = "--{$boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n{$plainBody}\r\n";
        $emailMessage .= "--{$boundary}\r\nContent-Type: {$fileType}; name=\"{$encodedName}\"\r\nContent-Disposition: attachment; filename=\"{$encodedName}\"\r\nContent-Transfer-Encoding: base64\r\n\r\n{$encodedFile}\r\n--{$boundary}--\r\n";
        $emailSent = mail($notifyEmail, $subject, $emailMessage, $headers);
    } else {
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $emailSent = mail($notifyEmail, $subject, $plainBody, $headers);
    }
}

if (!$tgSent && !$emailSent) {
    error_log('nanosoft contact delivery failed');
    respond(502, ['ok' => false, 'error' => 'Не удалось отправить заявку. Попробуйте позже или свяжитесь с нами в Telegram']);
}
respond(200, ['ok' => true]);




