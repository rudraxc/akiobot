export async function getAIReply(prompt, name = "User") {
  return `Hello ${name} 😄\nYou said: ${prompt}`;
}
