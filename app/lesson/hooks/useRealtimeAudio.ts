import { useRef } from "react";

import {
  buildRaioRealtimeOpeningInstructions,
  type RaioSpeakingLesson,
} from "@/domain/raio-curriculum";

export type RealtimeSession = {
  clientSecret: string;
  model: string;
  expiresAt: string;
  lessonId: string;
  connectUrl: string;
};

export type RealtimeConnection = {
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  stream: MediaStream;
  audioElement: HTMLAudioElement;
};

const REALTIME_CONNECT_TIMEOUT_MS = 25_000;

/**
 * Manages the OpenAI Realtime WebRTC connection lifecycle.
 *
 * Design constraints:
 * - Does NOT own connectionStatus state — the parent owns and drives it so
 *   the status transitions remain exactly as in the original lesson-client.
 * - Does NOT use useEffect to wire up the connection — the parent calls
 *   connect/disconnect imperatively, exactly as the original code did.
 * - Teardown: closeConnection() stops all mic tracks, closes the data channel,
 *   peer connection, and audio element. The parent calls closeConnection()
 *   explicitly (on complete/fail) and also on unmount via the cleanup ref.
 */
export function useRealtimeAudio() {
  const connectionRef = useRef<RealtimeConnection | null>(null);

  function closeConnection(connection: RealtimeConnection | null) {
    closeRealtimeResources(connection);
  }

  function replaceConnection(nextConnection: RealtimeConnection | null) {
    closeRealtimeResources(connectionRef.current);
    connectionRef.current = nextConnection;
  }

  async function connectRealtime(
    realtime: RealtimeSession,
    lessonPlan: RaioSpeakingLesson,
    onRealtimeEvent: (payload: string) => void,
  ): Promise<RealtimeConnection> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone APIs are unavailable in this browser.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const cleanupTarget: Partial<RealtimeConnection> = { stream };

    try {
      const peerConnection = new RTCPeerConnection();
      cleanupTarget.peerConnection = peerConnection;

      const dataChannel = peerConnection.createDataChannel("oai-events");
      cleanupTarget.dataChannel = dataChannel;
      dataChannel.onopen = () => {
        sendRealtimeTutorResponse(
          dataChannel,
          buildRaioRealtimeOpeningInstructions(lessonPlan),
        );
      };

      const audioElement = new Audio();
      audioElement.autoplay = true;
      cleanupTarget.audioElement = audioElement;

      stream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, stream));

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        audioElement.srcObject = remoteStream;
        void audioElement.play?.().catch(() => undefined);
      };

      dataChannel.onmessage = (event) => {
        if (typeof event.data === "string") {
          onRealtimeEvent(event.data);
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        REALTIME_CONNECT_TIMEOUT_MS,
      );

      let response: Response;

      try {
        response = await fetch(realtime.connectUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${realtime.clientSecret}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error(
            "Realtime tardó demasiado en responder. Activamos modo voz seguro.",
          );
        }

        throw error;
      } finally {
        window.clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error("Realtime connection failed safely. Retry the lesson.");
      }

      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: await response.text(),
      });

      return { peerConnection, dataChannel, stream, audioElement };
    } catch (error) {
      closeRealtimeResources(cleanupTarget);
      throw error;
    }
  }

  return {
    connectionRef,
    connectRealtime,
    closeConnection,
    replaceConnection,
  };
}

function sendRealtimeTutorResponse(
  dataChannel: RTCDataChannel,
  instructions: string,
) {
  if (dataChannel.readyState !== "open") return;

  dataChannel.send(
    JSON.stringify({
      type: "response.create",
      response: { instructions },
    }),
  );
}

function closeRealtimeResources(
  connection: Partial<RealtimeConnection> | null,
) {
  if (!connection) return;

  connection.stream
    ?.getTracks()
    .forEach((track) => runSafely(() => track.stop()));
  runSafely(() => connection.dataChannel?.close());
  runSafely(() => connection.peerConnection?.close());
  runSafely(() => connection.audioElement?.pause?.());
  runSafely(() => {
    if (connection.audioElement) connection.audioElement.srcObject = null;
  });
}

function runSafely(action: () => void) {
  try {
    action();
  } catch {
    // Cleanup should never block retrying or leaving the lesson safely.
  }
}
