const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: './src/renderer/index.ts',
  module: {
    rules: [
      {
        test: /\.svg$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024 // 8kb
          }
        }
      },
      {
        test: /\.vue$/,
        use: [
          {
            loader: 'vue-loader',
            options: {
              appendTsSuffixTo: [/\.vue$/],
              transpileOptions: {
                compilers: {
                  ts: require('ts-loader').transpileModule
                }
              }
            }
          }
        ]
      },
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.renderer.json'),
              appendTsSuffixTo: [/\.vue$/],
              transpileOnly: true
            }
          }
        ],
        exclude: [/node_modules/],
      },
      {
        test: /\.js$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.scss$/i,
        use: ['style-loader', 'css-loader', 'postcss-loader', 'sass-loader'],
      },
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false
        }
      },
      {
        test: /pdf\.worker\.m?js$/,
        type: 'asset/resource',
        generator: {
          filename: '[name][ext]'
        }
      }
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      favicon: './src/renderer/assets/app-logo.png',
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'node_modules', 'vscode-material-icons', 'generated', 'icons'),
          to: 'assets/material-icons',
        },
      ],
    }),
  ],
  resolve: {
    extensions: ['.ts', '.js', '.vue', '.json'],
    alias: {
      vue: '@vue/runtime-dom',
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@': path.resolve(__dirname, 'src/renderer'),
      '@assets': path.resolve(__dirname, 'src/renderer/assets'),
      '@shared': path.resolve(__dirname, 'src/shared')
    },
    conditionNames: ['import', 'require', 'node', 'default']
  },
  output: {
    path: path.resolve(__dirname, 'out', 'renderer'),
    filename: 'bundle.js',
  },
  // better-sqlite3 是原生模块，仅在主进程使用，渲染进程不需要打包
  externals: {
    'better-sqlite3': 'commonjs better-sqlite3',
  },
  devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'cheap-module-source-map',
  // 开发服务器配置 - 支持热更新
  devServer: {
    port: 5174,
    hot: true,
    static: {
      directory: path.join(__dirname, 'out', 'renderer'),
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
};
