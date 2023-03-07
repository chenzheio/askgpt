#!/usr/bin/env node

// @ts-ignore
import input from "input";
import ora from "ora";
import { marked } from "marked";
import terminalReader from "marked-terminal";
import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}
export const generatePayload = (apiKey: string, messages: ChatMessage[]): RequestInit => ({
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
})
export const parseOpenAIStream = (rawResponse: Response) => {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const stream = new ReadableStream({
        async start(controller) {
            const streamParser = (event: ParsedEvent | ReconnectInterval) => {
                if (event.type === 'event') {
                    const data = event.data
                    if (data === '[DONE]') {
                        controller.close()
                        return
                    }
                    try {
                        const json = JSON.parse(data)
                        const text = json.choices[0].delta?.content || ''
                        const queue = encoder.encode(text)
                        controller.enqueue(queue)
                    } catch (e) {
                        controller.error(e)
                    }
                }
            }

            const parser = createParser(streamParser)
            for await (const chunk of rawResponse.body as any) {
                parser.feed(decoder.decode(chunk))
            }
        },
    })

    return stream
}



import os from "os";
import { program } from "commander";
import { existsSync, readFileSync, writeFileSync } from "fs";

program
    .version("0.0.1")
    .option('-s,--set <OPENAI_API>', 'set OPENAI_API')
    .option('-h,--help', 'help')

program.parse(process.argv);

const options = program.opts();

if (options.set) {
    const hoemDir = os.homedir();
    writeFileSync(`${hoemDir}/.askgpt`, options.set)
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

const messages: ChatMessage[] = []

marked.setOptions({
    renderer: new terminalReader({
        emoji: true
    }),
});

async function main(msg: string) {
    const start = ora("正在生成回复...").start();
    messages.push({
        role: 'user',
        content: msg,
    })
    const request = generatePayload(OPENAI_API, messages.length > 5 ? messages.slice(messages.length - 5) : messages)
    const response = await fetch("https://api.openai.com/v1/chat/completions", request)
    const stream = parseOpenAIStream(response)
    const reader = stream.getReader()
    const decoder = new TextDecoder('utf-8')
    start.prefixText = "AI："
    let text = ""
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value)
        start.text = marked(text);
    }
    messages.push({
        role: 'assistant',
        content: text,
    })
    start.succeed();
    start.stop();
}

async function run() {
    try {
        while (true) {
            const msg = await input.text("您：")
            if (msg === "exit" || msg === "退出") break;
            await main(msg)
        }
    } catch (error) {
        console.log("发生了意外的错误,请稍后再试.")
        process.exit(0);
    }
}

run()