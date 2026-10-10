import {spanish} from './es.mjs';
document.documentElement.lang='es';
const attributes=['placeholder','aria-label','title','alt'];
function translateNode(node){
 if(node.nodeType===Node.TEXT_NODE){if(!node.parentElement||node.parentElement.closest('script,style,textarea,[data-no-translate]'))return;const before=node.nodeValue,after=spanish(before);if(after!==before){const option=node.parentElement.closest('option');if(option&&!option.hasAttribute('value'))option.value=option.value;node.nodeValue=after;}return;}
 if(node.nodeType!==Node.ELEMENT_NODE&&node.nodeType!==Node.DOCUMENT_NODE)return;
 if(node.nodeType===Node.ELEMENT_NODE){for(const attribute of attributes){const value=node.getAttribute(attribute);if(value){const next=spanish(value);if(next!==value)node.setAttribute(attribute,next);}}}
 const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let child;while((child=walker.nextNode()))translateNode(child);
 if(node.querySelectorAll)node.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(el=>{for(const attribute of attributes){const value=el.getAttribute(attribute);if(value){const next=spanish(value);if(next!==value)el.setAttribute(attribute,next);}}});
}
translateNode(document);
new MutationObserver(records=>{for(const record of records){if(record.type==='childList')record.addedNodes.forEach(translateNode);else translateNode(record.target);}}).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
