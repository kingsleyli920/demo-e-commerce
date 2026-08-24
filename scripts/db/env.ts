import { config as loadEnv } from 'dotenv';

// 脚本环境：先 .env.local 再 .env（与 Next 一致的优先级）
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });
