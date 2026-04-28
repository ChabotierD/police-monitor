<?php
// api.php - Backend Proxy Server

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$channel = $_GET['channel'] ?? '';

// ==========================================
// פונקציה 1: עוקף יוטיוב (עבור 14, DW, NBC)
// ==========================================
function getYoutubeLiveUrl($channelId) {
    $url = "https://www.youtube.com/channel/{$channelId}/live";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Cookie: SOCS=CAEQAw; CONSENT=YES+cb.20230101-17-p0.en+FX+478;",
        "Accept-Language: he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7"
    ]);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10); 
    $html = curl_exec($ch);
    $effectiveUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    curl_close($ch);

    if (preg_match('/watch\?v=([a-zA-Z0-9_-]+)/', $effectiveUrl, $matches)) {
        return "https://www.youtube.com/embed/{$matches[1]}?autoplay=1&mute=1";
    }
    if (preg_match('/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)"/i', $html, $matches)) {
        return "https://www.youtube.com/embed/{$matches[1]}?autoplay=1&mute=1";
    }
    if (preg_match('/"videoDetails":{"videoId":"([^"]+)"/', $html, $matches)) {
        return "https://www.youtube.com/embed/{$matches[1]}?autoplay=1&mute=1";
    }
    return ['error' => 'Live video ID not found in YouTube'];
}

// ==========================================
// פונקציה 2: חילוץ Iframe (עבור קשת 12 - עובד מצוין)
// ==========================================
function getGuruTvInnerIframe($pageName) {
    $url = "https://gurutv.online/" . $pageName;
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10); 
    $html = curl_exec($ch);
    curl_close($ch);

    if (preg_match('/<div class="videoplayer"[^>]*>.*?<iframe[^>]+src=["\']([^"\']+)["\']/is', $html, $matches)) {
        $iframeSrc = $matches[1];
        if (strpos($iframeSrc, '//') === 0) { $iframeSrc = 'https:' . $iframeSrc; } 
        elseif (strpos($iframeSrc, 'http') !== 0) { $iframeSrc = 'https://gurutv.online/' . ltrim($iframeSrc, '/'); }
        return $iframeSrc;
    }
    return ['error' => 'Could not find inner Iframe on GuruTV page.'];
}

// ==========================================
// פונקציה 3: חילוץ M3U8 ישיר (עבור כאן 11 ו-i24) - **הפונקציה החדשה לפי התגלית שלך**
// ==========================================
function getGuruTvHls($pageName) {
    $url = "https://gurutv.online/" . $pageName;
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10); 
    $html = curl_exec($ch);
    curl_close($ch);

    // מחפשים את המשתנה m3u8Url בדיוק כמו שראית בקוד המקור
    if (preg_match('/m3u8Url\s*=\s*[\'"]([^\'"]+)[\'"]/i', $html, $matches)) {
        return $matches[1];
    }
    // חיפוש רחב יותר למקרה שזה מוגדר קצת אחרת (גיבוי)
    if (preg_match('/[\'"](https?:\/\/[^\'"]+\.m3u8[^\'"]*)[\'"]/i', $html, $matches)) {
        return $matches[1];
    }
    return ['error' => 'Could not find M3U8 link in JavaScript.'];
}


$response = ['success' => false, 'type' => '', 'url' => '', 'message' => ''];

switch ($channel) {
    case '12':
        // ממשיך לעבוד כרגיל עם Iframe
        $result = getGuruTvInnerIframe('ch12.html');
        if (is_string($result)) { $response = ['success' => true, 'type' => 'iframe', 'url' => $result]; }
        else { $response['message'] = $result['error']; }
        break;

    case '11':
        // שודרג לשימוש ב-HLS ישיר לפי התגלית
        $result = getGuruTvHls('ch11.html');
        if (is_string($result)) { $response = ['success' => true, 'type' => 'hls', 'url' => $result]; }
        else { $response['message'] = $result['error']; }
        break;

    case 'i24':
        // שודרג לשימוש ב-HLS ישיר לפי התגלית
        $result = getGuruTvHls('chi24news.html');
        if (is_string($result)) { $response = ['success' => true, 'type' => 'hls', 'url' => $result]; }
        else { $response['message'] = $result['error']; }
        break;

    case '14':
        $result = getYoutubeLiveUrl('UCKEImtWikw9usC1pl_9m1nQ');
        if (is_string($result)) { $response = ['success' => true, 'type' => 'iframe', 'url' => $result]; }
        else { $response['message'] = $result['error']; }
        break;

    case 'dw':
        $result = getYoutubeLiveUrl('UCknLrEdhRCp1aegoMqRaCZg');
        if (is_string($result)) { $response = ['success' => true, 'type' => 'iframe', 'url' => $result]; }
        else { $response['message'] = $result['error']; }
        break;

    case 'nbc':
        $result = getYoutubeLiveUrl('UCeY0bbntWzzVIaj2z3QigXg');
        if (is_string($result)) { $response = ['success' => true, 'type' => 'iframe', 'url' => $result]; }
        else { $response['message'] = $result['error']; }
        break;

    default:
        $response['message'] = 'Channel not supported';
}

echo json_encode($response);
?>