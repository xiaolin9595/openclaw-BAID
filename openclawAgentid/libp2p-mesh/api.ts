export { createMeshNetwork } from "./src/mesh.js";
export { createInstancePeerStore } from "./src/instance-peer-store.js";
export { createInstanceRouter } from "./src/instance-router.js";
export {
  AgentIdJwksCache,
  AgentIdBindingStatusCache,
  getAgentIdEnforcementMode,
  getTrustedAgentIdIssuers,
  linkAgentId,
  loadAgentIdBinding,
  resolveAgentIdBindingPath,
  saveAgentIdBinding,
  unlinkAgentIdBinding,
  verifyAgentIdIbc,
  verifyAgentIdBindingStatus,
} from "./src/agentid.js";
export type { AgentIdBindingFile, AgentIdIbcClaims } from "./src/agentid.js";
export type {
  DeliveryAckPayload,
  InboundDeliveryAdapter,
  InboundDeliveryRequest,
  InboundDeliveryResult,
  InstanceAnnouncePayload,
  InstanceIdentity,
  InstancePeerRecord,
  InstancePeerStore,
  InstancePeerTable,
  InstanceRouter,
  AgentIdCacheConfig,
  AgentIdConfig,
  AgentIdEnforcementMode,
  MeshConfig,
  MeshNetwork,
  P2PMessage,
  P2PMessageType,
  UserMessagePayload,
} from "./src/types.js";
