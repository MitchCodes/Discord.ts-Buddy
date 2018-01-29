const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    module: {
        rules: [
            // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
            { 
                test: /\.tsx?$/, 
                loader: 'ts-loader'
            },
            { 
                test: /\.(jpe?g|gif|png|svg|woff|ttf|wav|mp3|json)$/, 
                loader: "file-loader",
                options: {
                    name: '[name].[ext]'
                }
            }
        ]
    }
});