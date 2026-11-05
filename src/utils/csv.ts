export function parseCsv(text:string): string[][] {
  if(text.length>5_000_000) throw new Error('CSV file exceeds the 5 MB limit.');
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) { const ch=text[i]!;
    if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;}
    else if(ch==='"'&&cell.length===0)quoted=true;
    else if(ch===','){row.push(cell);cell='';}
    else if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(quoted) throw new Error('CSV contains an unclosed quoted value.');
  if(cell.length||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
  return rows.filter(r=>r.some(v=>v.trim()));
}
export function safeCsvCell(value:unknown):string { const raw=String(value??'');const safe=/^[\s\uFEFF]*[=+@\-\t\r]/.test(raw)?`'${raw}`:raw;return `"${safe.replace(/"/g,'""')}"`; }
