(function(root){
'use strict';
root.UIPatch={text(node,value){value=String(value??'');if(node&&node.textContent!==value)node.textContent=value;},attr(node,name,value){value=String(value);if(node&&node.getAttribute(name)!==value)node.setAttribute(name,value);}};
})(globalThis);
