"use client";

/* React hook for managing the chaos computation Web Worker.
 * Handles worker lifecycle, job submission with auto-cancellation, and cleanup. */

import { useRef, useEffect, useCallback } from "react";
import type { WorkerResponse, ComputeRequest, JobId } from "@/lib/types";

type ResponseHandler = (msg: WorkerResponse) => void;

export function useWorker(onMessage: ResponseHandler) {
  const workerRef = useRef<Worker | null>(null);
  const currentJobRef = useRef<JobId | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/chaos.worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      // Ignore messages from stale jobs
      if ("jobId" in msg && msg.jobId !== currentJobRef.current) return;
      onMessageRef.current(msg);
    };

    worker.onerror = (err) => {
      console.error("[Worker error]", err);
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  /** Submit a new computation job. Automatically cancels any previous job.
   *  Returns the new jobId. */
  const submit = useCallback(
    (req: Omit<ComputeRequest, "type" | "jobId">): JobId => {
      const jobId = crypto.randomUUID();

      // Cancel previous job
      if (currentJobRef.current && workerRef.current) {
        workerRef.current.postMessage({
          type: "cancel",
          jobId: currentJobRef.current,
        });
      }

      currentJobRef.current = jobId;

      workerRef.current?.postMessage({
        type: "compute",
        jobId,
        ...req,
      });

      return jobId;
    },
    []
  );

  /** Cancel the current job */
  const cancel = useCallback(() => {
    if (currentJobRef.current && workerRef.current) {
      workerRef.current.postMessage({
        type: "cancel",
        jobId: currentJobRef.current,
      });
      currentJobRef.current = null;
    }
  }, []);

  /** Request the worker to continue streaming the next chunk */
  const requestContinue = useCallback((jobId: JobId) => {
    workerRef.current?.postMessage({ type: "continue", jobId });
  }, []);

  return { submit, cancel, requestContinue, currentJobRef };
}
