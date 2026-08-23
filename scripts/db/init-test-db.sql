-- 首次初始化数据卷时自动创建测试库（drizzle migrate 到 shop_test 由 pnpm test:unit 负责）
CREATE DATABASE shop_test;
