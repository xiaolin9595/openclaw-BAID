import type { P2PMessage } from "./types.js";
import { verifyInstanceSignature } from "./instance-id.js";
import {
  hasAgentIdCredential,
  serializeLegacyP2PMessageForSignature,
  serializeP2PMessageForSignature,
} from "./message-auth.js";

export type InboundHandlerDeps = {
  logger?: {
    info?: (msg: string) => void;
    debug?: (msg: string) => void;
    warn?: (msg: string) => void;
    error?: (msg: string) => void;
  };
  sendToChannel?: (channelId: string, target: string, text: string) => Promise<void>;
};

export function handleP2PInbound(msg: P2PMessage, deps: InboundHandlerDeps): void {
  const { logger, sendToChannel } = deps;
  const instanceTag = msg.instanceId ? ` [instance: ${msg.instanceId}]` : "";
  const signedTag = msg.signature ? " [signed]" : "";

  // Verify signature if present
  if (msg.signature && msg.instanceId && msg.pubkey) {
    const identity = {
      id: msg.instanceId,
      name: "",
      pubkey: msg.pubkey,
      binding: "",
      bindingComponents: { username: "", hostname: "", platform: "" },
      createdAt: 0,
    };
    const valid = verifyInstanceSignature(
      identity,
      serializeP2PMessageForSignature(msg),
      msg.signature,
    ) || (!hasAgentIdCredential(msg) && verifyInstanceSignature(
      identity,
      serializeLegacyP2PMessageForSignature(msg),
      msg.signature,
    ));
    if (valid) {
      logger?.info?.(`[libp2p-mesh] Verified signature from instance ${msg.instanceId}`);
    } else {
      logger?.warn?.(`[libp2p-mesh] Invalid signature from instance ${msg.instanceId}`);
    }
  } else if (msg.signature) {
    logger?.warn?.(`[libp2p-mesh] Message has signature but no pubkey; cannot verify`);
  }

  if (msg.type === "broadcast") {
    logger?.info?.(
      `[libp2p-mesh] Broadcast from ${msg.from}${instanceTag}${signedTag} on topic ${msg.topic ?? "(none)"}: ${msg.payload}`,
    );
    return;
  }

  // Direct message — log and forward to local channel
  logger?.info?.(
    `[libp2p-mesh] Direct message from ${msg.from}${instanceTag}${signedTag}: ${msg.payload}`,
  );

  if (!sendToChannel || !msg.payload) {
    return;
  }

  const sender = msg.instanceId ?? msg.from;
  const text = `[来自 ${sender}]\n${msg.payload}`;
  sendToChannel("libp2p-mesh", msg.from, text).catch((err) => {
    logger?.error?.(`[libp2p-mesh] Failed to forward direct message from ${msg.from}: ${err}`);
  });
}
