# ⬛️ SecuRedact

A tool for redacting sensitive information from PDF documents using AI assistance.

> ⚠️ **DISCLAIMER**: This software is currently in development and not yet ready for production use. Use at your own risk and always verify redactions manually.

Everything runs completely locally in your browser.

Older devices can optionally connect to a server to speed things up.

## Features

- [x] [display and annotate PDFs](https://github.com/agentcooper/react-pdf-highlighter)
- [x] [safely redact the PDF based on the annotations](https://github.com/ArtifexSoftware/mupdf.js)
- [x] [use AI to automatically detect personal information](https://github.com/huggingface/transformers.js)
  - [x] [based on named entity recognition](https://huggingface.co/Xenova/bert-base-multilingual-cased-ner-hrl)
  - [ ] [based on chat models](https://huggingface.co/onnx-community/Qwen2.5-1.5B-Instruct;https://huggingface.co/onnx-community/Llama-3.2-1B-Instruct)
  - [ ] [optionally connect to large language models](https://github.com/vllm-project/vllm)
- [ ] [supports scanned PDFs](https://github.com/naptha/tesseract.js/)
- [ ] [converts Word documents to PDF](https://github.com/georgestagg/pandoc-wasm)

## License

MIT License (c) BMZ / David Pomerenke

The frontend is based on an example from [react-pdf-highlighter](https://github.com/agentcooper/react-pdf-highlighter/), MIT License.
