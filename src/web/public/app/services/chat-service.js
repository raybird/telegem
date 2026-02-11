export function createChatService(api) {
  return {
    streamMessage(message, handlers) {
      return api.streamChat(message, handlers);
    }
  };
}
