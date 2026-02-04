<?php
// Configuração do Dashboard UNRAID
// IMPORTANTE: Renomeie este arquivo para "config.php" e preencha com suas informações

// Defina seu PIN de acesso (4 dígitos numéricos)
define('ACCESS_PIN', '0000');

// Nome do Servidor (aparecerá no topo do Dashboard)
define('SERVER_NAME', 'Meu Servidor UNRAID');

// URL do seu servidor UNRAID
// Exemplo com MyUnraid: https://192-168-1-10.xxxxxxxx.myunraid.net
// Exemplo com IP local: https://192.168.1.10
define('UNRAID_HOST', 'https://seu-servidor-unraid.myunraid.net');

// Chave da API do UNRAID
// Gere em: Settings -> API -> Generate API Key
define('UNRAID_API_KEY', 'sua_chave_api_aqui');

// Endpoint da API GraphQL (padrão para UNRAID 7.2+)
define('UNRAID_API_ENDPOINT', '/graphql');

// Intervalo de atualização do dashboard em milissegundos
// 2000 = 2 segundos, 5000 = 5 segundos, 10000 = 10 segundos
define('REFRESH_INTERVAL', 5000);
?>
