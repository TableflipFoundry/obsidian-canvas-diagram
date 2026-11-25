import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

export function parseNote(text) {
  text=text.replace(/^\uFEFF/,'');
  const match=text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const body=match?text.slice(match[0].length).trim():text.trim();
  if(!match)return{fm:{},hasFront:false,body,errors:['missing YAML frontmatter']};
  try{
    const fm=require('yaml').parse(match[1]);
    if(!fm||typeof fm!=='object'||Array.isArray(fm))throw new Error('frontmatter must be a mapping');
    return{fm,hasFront:true,body,errors:[]};
  }catch(error){return{fm:{},hasFront:true,body,errors:[`invalid YAML: ${error.message.split('\n')[0]}`]};}
}
