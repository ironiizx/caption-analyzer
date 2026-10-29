import {config,json} from '@/lib/server';
export async function GET(){const c=config();return json({aiConfigured:!!c.OPENAI_API_KEY,storageConfigured:!!c.DB&&!!c.BUCKET,dailyLimit:20});}
