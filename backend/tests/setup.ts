import { config } from 'dotenv';

// Lokal ishga tushirishda backend/.env dan TEST_DATABASE_URL olinadi (mavjud qiymatlar ustidan yozilmaydi)
config({ quiet: true });
process.env.NODE_ENV = 'test';
