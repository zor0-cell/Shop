"use client";
import {useEffect} from "react";
export default function Page(){
  useEffect(()=>{const script=document.createElement("script");script.type="module";script.src="/shop.js";document.body.appendChild(script);return ()=>script.remove()},[]);
  return <div id="shop"><div className="loading">✦ Hoshi Shop</div></div>;
}
