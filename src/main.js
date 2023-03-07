#!/usr/bin/env node
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
// @ts-ignore
import input from "input";
import ora from "ora";
import { marked } from "marked";
import terminalReader from "marked-terminal";
import { createParser } from 'eventsource-parser';
export const generatePayload = (apiKey, messages) => ({
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
    },
    method: 'POST',
    body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
        temperature: 0.6,
        stream: true,
    }),
});
export const parseOpenAIStream = (rawResponse) => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const stream = new ReadableStream({
        start(controller) {
            var _a, e_1, _b, _c;
            return __awaiter(this, void 0, void 0, function* () {
                const streamParser = (event) => {
                    var _a;
                    if (event.type === 'event') {
                        const data = event.data;
                        if (data === '[DONE]') {
                            controller.close();
                            return;
                        }
                        try {
                            const json = JSON.parse(data);
                            const text = ((_a = json.choices[0].delta) === null || _a === void 0 ? void 0 : _a.content) || '';
                            const queue = encoder.encode(text);
                            controller.enqueue(queue);
                        }
                        catch (e) {
                            controller.error(e);
                        }
                    }
                };
                const parser = createParser(streamParser);
                try {
                    for (var _d = true, _e = __asyncValues(rawResponse.body), _f; _f = yield _e.next(), _a = _f.done, !_a;) {
                        _c = _f.value;
                        _d = false;
                        try {
                            const chunk = _c;
                            parser.feed(decoder.decode(chunk));
                        }
                        finally {
                            _d = true;
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            });
        },
    });
    return stream;
};
import os from "os";
import { program } from "commander";
import { existsSync, readFileSync, writeFileSync } from "fs";
program
    .version("0.0.1")
    .option('-s,--set <OPENAI_API>', 'set OPENAI_API')
    .option('-h,--help', 'help');
program.parse(process.argv);
const options = program.opts();
if (options.set) {
    const hoemDir = os.homedir();
    writeFileSync(`${hoemDir}/.askgpt`, options.set);
    console.log("设置成功");
}
if (options.help) {
    console.log("使用方法: askgpt 启动后输入你想说的话, 然后回车, 就会自动回复, 输入exit退出");
    console.log("设置OPENAI_API: askgpt -s OPENAI_API");
    console.log("获取OPENAI_API: https://platform.openai.com/account/api-keys");
    process.exit(0);
}
// 检测配置文件是否存在
const hoemDir = os.homedir();
if (existsSync(`${hoemDir}/.askgpt`) === false) {
    console.log("请先设置OPENAI_API");
    process.exit(0);
}
// 读取配置文件
const OPENAI_API = readFileSync(`${hoemDir}/.askgpt`, "utf-8");
const messages = [];
marked.setOptions({
    renderer: new terminalReader({
        emoji: true
    }),
});
function main(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const start = ora("正在生成回复...").start();
        messages.push({
            role: 'user',
            content: msg,
        });
        const request = generatePayload(OPENAI_API, messages.length > 5 ? messages.slice(messages.length - 5) : messages);
        const response = yield fetch("https://api.openai.com/v1/chat/completions", request);
        const stream = parseOpenAIStream(response);
        const reader = stream.getReader();
        const decoder = new TextDecoder('utf-8');
        start.prefixText = "AI：";
        let text = "";
        while (true) {
            const { done, value } = yield reader.read();
            if (done)
                break;
            text += decoder.decode(value);
            start.text = marked(text);
        }
        messages.push({
            role: 'assistant',
            content: text,
        });
        start.succeed();
        start.stop();
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            while (true) {
                const msg = yield input.text("您：");
                if (msg === "exit" || msg === "退出")
                    break;
                yield main(msg);
            }
        }
        catch (error) {
            console.log("发生了意外的错误,请稍后再试.");
            process.exit(0);
        }
    });
}
run();
