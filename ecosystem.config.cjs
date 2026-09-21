module.exports = {
  apps: [
    {
      name: 'qms-backend',
      script: './server.js',
      cwd: './backend',
      instances: 4,                 // 4 Replicas utilizing 4 vCPUs on the 8 vCPU plan
      exec_mode: 'cluster',         // Multi-process cluster mode
      max_memory_restart: '768M',   // Enforces strict memory ceiling for 8GB RAM plan
      node_args: '--max-old-space-size=768',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
        DB_POOL_LIMIT: 35
      }
    }
  ]
};
