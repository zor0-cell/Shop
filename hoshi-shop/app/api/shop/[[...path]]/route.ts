import {env} from "cloudflare:workers";
import {handle} from "../../../../lib/shop.mjs";
export const dynamic="force-dynamic";
export const GET=(request:Request)=>handle(request,env);
export const POST=GET;
