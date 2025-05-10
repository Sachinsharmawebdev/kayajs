import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';

const isDev = process.env.NODE_ENV === 'development';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/bundle.cjs.js',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: 'dist/bundle.esm.js',
      format: 'esm',
      sourcemap: true
    }
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({ 
      useTsconfigDeclarationDir: true,
      clean: true,
      tsconfigOverride: {
        compilerOptions: {
          sourceMap: isDev
        }
      }
    }),
    !isDev && terser(),
    isDev && serve({
      open: true,
      contentBase: ['dist', '.'],
      port: 3000,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      }
    }),
    isDev && livereload({
      watch: ['dist', 'templates', 'src'],
      verbose: true,
      delay: 200
    })
  ].filter(Boolean),
  watch: {
    include: ['src/**', 'templates/**'],
    exclude: 'node_modules/**'
  }
}; 