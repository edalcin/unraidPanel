<?php
header('Content-Type: application/json');
require_once 'config.php';

// Receber dados do input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid Request']);
    exit;
}

// Info Pública
if (isset($input['action']) && $input['action'] === 'public_info') {
    echo json_encode([
        'success' => true,
        'server_name' => SERVER_NAME,
        'refresh_interval' => REFRESH_INTERVAL
    ]);
    exit;
}

// Verificar PIN
if (!isset($input['pin']) || $input['pin'] !== ACCESS_PIN) {
    http_response_code(401);
    echo json_encode(['error' => 'PIN Incorreto']);
    exit;
}

// Login Check
if (isset($input['action']) && $input['action'] === 'login') {
    echo json_encode(['success' => true]);
    exit;
}

// Conexão UNRAID
function fetchUnraidData($query) {
    $url = UNRAID_HOST . UNRAID_API_ENDPOINT;

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['query' => $query]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'X-API-Key: ' . UNRAID_API_KEY
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);

    $result = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($curlError) {
        return ['curl_error' => $curlError];
    }

    if ($httpCode !== 200 || !$result) {
        return ['http_error' => "HTTP $httpCode", 'response' => $result];
    }

    return json_decode($result, true);
}

// QUERY GraphQL completa
$graphQLQuery = '
{
  array {
    state
    disks {
      name
      temp
      size
      fsSize
      fsUsed
      fsFree
    }
    parities {
      name
      temp
      size
      fsSize
      fsUsed
      fsFree
    }
    caches {
      name
      temp
      size
      fsSize
      fsUsed
      fsFree
    }
  }
  info {
    cpu {
      manufacturer
      brand
      cores
      threads
      packages {
        temp
      }
    }
  }
  metrics {
    cpu {
      percentTotal
    }
    memory {
      total
      used
      free
      percentTotal
    }
  }
}
';

$realData = fetchUnraidData($graphQLQuery);

// Erro de conexão cURL
if (isset($realData['curl_error'])) {
    echo json_encode(['success' => false, 'error' => 'Conexão falhou: ' . $realData['curl_error']]);
    exit;
}

// Erro HTTP (não 200)
if (isset($realData['http_error'])) {
    echo json_encode(['success' => false, 'error' => $realData['http_error'], 'response' => $realData['response'] ?? '']);
    exit;
}

// Erro GraphQL
if (isset($realData['errors'])) {
    echo json_encode(['success' => false, 'error' => $realData['errors'][0]['message']]);
    exit;
}

if (isset($realData['data'])) {

    $raw = $realData['data'];

    // DEBUG: Log dos dados brutos do array
    error_log("DEBUG - Array disks: " . json_encode($raw['array']['disks'] ?? 'N/A'));
    error_log("DEBUG - Array caches: " . json_encode($raw['array']['caches'] ?? 'N/A'));

    // Memória de metrics
    $memTotal = $raw['metrics']['memory']['total'] ?? 0;
    $memUsed = $raw['metrics']['memory']['used'] ?? 0;
    $memPercent = $raw['metrics']['memory']['percentTotal'] ?? 0;

    // CPU usage de metrics
    $cpuPercent = $raw['metrics']['cpu']['percentTotal'] ?? 0;

    // CPU temperature (média dos packages)
    $cpuTemps = $raw['info']['cpu']['packages']['temp'] ?? [];
    $cpuTemp = count($cpuTemps) > 0 ? round(array_sum($cpuTemps) / count($cpuTemps)) : 0;

    // Processar Dados
    $processed = [
        'server_name' => SERVER_NAME,
        'refresh_interval' => REFRESH_INTERVAL,
        'system' => [
            'cpu_brand' => $raw['info']['cpu']['brand'] ?? 'Desconhecido',
            'cpu_cores' => $raw['info']['cpu']['cores'] ?? 0,
            'cpu_threads' => $raw['info']['cpu']['threads'] ?? 0,
            'cpu_percent' => round($cpuPercent),
            'cpu_temp' => $cpuTemp,
            'mem_used' => round($memUsed / 1073741824, 1),
            'mem_total' => round($memTotal / 1073741824, 1),
            'mem_percent' => round($memPercent)
        ],
        'disks' => [],
        'array_storage' => [
            'total' => 0,
            'used' => 0,
            'free' => 0,
            'percent' => 0
        ],
        'cache_storage' => [
            'total' => 0,
            'used' => 0,
            'free' => 0,
            'percent' => 0
        ]
    ];

    // Variáveis para calcular espaço total do array e cache (em KB)
    $arrayTotalKB = 0;
    $arrayUsedKB = 0;
    $cacheTotalKB = 0;
    $cacheUsedKB = 0;

    // Função para processar disco
    function processDisk($disk, $type = 'data') {
        if (empty($disk['name'])) return null;

        $fill = 0;
        $fsUsed = 0;
        $fsFree = 0;
        $fsSize = 0;

        // Converter strings para números se necessário
        $fsUsed = isset($disk['fsUsed']) ? (int)$disk['fsUsed'] : 0;
        $fsFree = isset($disk['fsFree']) ? (int)$disk['fsFree'] : 0;
        $fsSize = isset($disk['fsSize']) ? (int)$disk['fsSize'] : 0;

        // Calcular total (preferir fsSize se disponível)
        $total = $fsSize > 0 ? $fsSize : ($fsUsed + $fsFree);

        if ($total > 0 && $fsUsed > 0) {
            $fill = round(($fsUsed / $total) * 100);
        }

        $status = 'OK';
        if (isset($disk['temp']) && $disk['temp'] > 50) $status = 'Hot';

        return [
            'name' => $disk['name'],
            'type' => $type,
            'temp' => $disk['temp'] ?? 0,
            'status' => $status,
            'fill' => $fill,
            'fsUsed' => $fsUsed,
            'fsFree' => $fsFree,
            'fsSize' => $fsSize
        ];
    }

    // Processar Paridades
    if (isset($raw['array']['parities'])) {
        foreach ($raw['array']['parities'] as $disk) {
            $d = processDisk($disk, 'parity');
            if ($d) $processed['disks'][] = $d;
        }
    }

    // Processar Discos do Array
    if (isset($raw['array']['disks'])) {
        foreach ($raw['array']['disks'] as $disk) {
            $d = processDisk($disk, 'data');
            if ($d) {
                $processed['disks'][] = $d;
                // Somar ao total do array (apenas discos de dados) - valores em KB
                error_log("DEBUG - Disk {$d['name']}: fsSize={$d['fsSize']}, fsUsed={$d['fsUsed']}, fsFree={$d['fsFree']}");

                // Usar fsSize se disponível, senão somar fsUsed + fsFree
                $diskTotal = $d['fsSize'] > 0 ? $d['fsSize'] : ($d['fsUsed'] + $d['fsFree']);

                if ($diskTotal > 0) {
                    $arrayUsedKB += $d['fsUsed'];
                    $arrayTotalKB += $diskTotal;
                }
            }
        }
    }
    error_log("DEBUG - Array Total: arrayUsedKB=$arrayUsedKB, arrayTotalKB=$arrayTotalKB");

    // Processar Cache
    if (isset($raw['array']['caches'])) {
        foreach ($raw['array']['caches'] as $disk) {
            $d = processDisk($disk, 'cache');
            if ($d) {
                $processed['disks'][] = $d;
                // Somar ao total do cache - valores em KB
                error_log("DEBUG - Cache {$d['name']}: fsSize={$d['fsSize']}, fsUsed={$d['fsUsed']}, fsFree={$d['fsFree']}");

                // Usar fsSize se disponível, senão somar fsUsed + fsFree
                $diskTotal = $d['fsSize'] > 0 ? $d['fsSize'] : ($d['fsUsed'] + $d['fsFree']);

                if ($diskTotal > 0) {
                    $cacheUsedKB += $d['fsUsed'];
                    $cacheTotalKB += $diskTotal;
                }
            }
        }
    }
    error_log("DEBUG - Cache Total: cacheUsedKB=$cacheUsedKB, cacheTotalKB=$cacheTotalKB");

    // Calcular estatísticas do array (converter de KB para TB)
    if ($arrayTotalKB > 0) {
        $processed['array_storage'] = [
            'total' => round($arrayTotalKB / 1073741824, 2), // KB para TB (1024^3)
            'used' => round($arrayUsedKB / 1073741824, 2),
            'free' => round(($arrayTotalKB - $arrayUsedKB) / 1073741824, 2),
            'percent' => round(($arrayUsedKB / $arrayTotalKB) * 100)
        ];
    }

    // Calcular estatísticas do cache (converter de KB para TB)
    if ($cacheTotalKB > 0) {
        $processed['cache_storage'] = [
            'total' => round($cacheTotalKB / 1073741824, 2), // KB para TB (1024^3)
            'used' => round($cacheUsedKB / 1073741824, 2),
            'free' => round(($cacheTotalKB - $cacheUsedKB) / 1073741824, 2),
            'percent' => round(($cacheUsedKB / $cacheTotalKB) * 100)
        ];
    }

    echo json_encode(['success' => true, 'data' => $processed]);

} else {
    echo json_encode(['success' => false, 'error' => 'Sem dados']);
}
?>