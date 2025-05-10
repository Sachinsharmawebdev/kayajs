import { renderKy } from './dist/bundle.esm.js';
// import renderKy from './src/renderKy.ts';

    (async () => {
      const html = await renderKy('./templates/main.ky',{});
      document.getElementById('app').innerHTML = html;
})().catch(console.error);