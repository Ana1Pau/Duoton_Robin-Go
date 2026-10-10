import {chatConfig,configured} from '@/lib/robin/agent-chat.mjs';
import {robinStore} from '@/lib/robin/store.mjs';
import {reply} from '@/lib/robin/http';
export const dynamic='force-dynamic';
export async function GET(){const config=chatConfig(process.env);return reply({enabled:configured(config),provider:configured(config)?config.provider:null,storage:robinStore.kind,singleUserDemo:true,realPayments:false});}
