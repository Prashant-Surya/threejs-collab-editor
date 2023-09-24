// webpack.config.js
const path = require("path");

module.exports = {
  entry: "./main.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  devServer: {
    static: {
      directory: ".",
    },
    compress: true,
    port: 8888,
    hot: true,
  },
};
