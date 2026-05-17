// Used by git filter-branch --msg-filter to remove Cursor co-author trailers
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  data += chunk;
});
process.stdin.on('end', () => {
  const cleaned = data.replace(/\r?\nCo-authored-by: Cursor <cursoragent@cursor\.com>\r?\n?/g, '\n');
  process.stdout.write(cleaned);
});
