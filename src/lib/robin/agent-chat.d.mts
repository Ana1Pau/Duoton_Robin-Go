export interface ChatConfig { enabled:boolean;provider:string;model:string;baseUrl:string; }
export function chatConfig(env:Record<string,string|undefined>):ChatConfig;
export function configured(config:ChatConfig):boolean;
export function chat(body:unknown,config:ChatConfig):Promise<unknown>;
