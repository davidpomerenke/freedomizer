import { useRef, useState, useEffect } from 'react';
import * as Comlink from 'comlink';
import type { MupdfWorker } from '../workers/mupdf.worker';

export function useMupdf() {
    const [workerInitialized, setWorkerInitialized] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const workerRef = useRef < Worker > ();
    const mupdfWorkerRef = useRef < Comlink.Remote < MupdfWorker >> ();

    useEffect(() => {
        workerRef.current = new Worker(
            new URL('../workers/mupdf.worker.ts', import.meta.url),
            { type: 'module' }
        );
        mupdfWorkerRef.current = Comlink.wrap < MupdfWorker > (workerRef.current);

        workerRef.current.addEventListener('message', (event) => {
            if (event.data === 'MUPDF_LOADED') {
                setWorkerInitialized(true);
            }
        });

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const loadDocument = async (arrayBuffer: ArrayBuffer) => {
        if (!mupdfWorkerRef.current) throw new Error('Worker not initialized');
        return mupdfWorkerRef.current.loadDocument(arrayBuffer);
    };

    const renderPage = async (pageIndex: number) => {
        if (!mupdfWorkerRef.current) throw new Error('Worker not initialized');
        setCurrentPage(pageIndex);
        return mupdfWorkerRef.current.renderPageAsImage(
            pageIndex,
            (window.devicePixelRatio * 96) / 72
        );
    };

    return {
        workerInitialized,
        loadDocument,
        renderPage,
        currentPage,
    };
}