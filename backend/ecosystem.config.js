module.exports = {
  apps: [
    {
      name: 'csq-backend',
      script: 'dist/src/main.js',
      instances: 'max',          // usa todos los cores disponibles
      exec_mode: 'cluster',      // modo cluster Node.js
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
      },
      // Reinicio graceful — espera que las conexiones activas terminen
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      // Logs
      out_file: '/dev/null',
      error_file: '/dev/null',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
