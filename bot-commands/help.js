module.exports.config = {
  name: "help",
  aliases: ["h", "commands", "cmds"],
  version: "1.0.0",
  role: 0,
  credits: "Vern",
  hasPrefix: true,
  description: "Show all available bot commands or details about a specific command",
  usage: "help [command name]",
  cooldowns: 5
};

module.exports.run = async function({ api, event, args, prefix, Utils }) {
  const { threadID, messageID } = event;

  if (args[0]) {
    const cmdName = args[0].toLowerCase();
    const found = Array.from(Utils.commands.values()).find(c =>
      c.name === cmdName || (c.aliases || []).includes(cmdName)
    );
    if (!found) {
      return api.sendMessage(`Command "${cmdName}" not found. Use ${prefix}help to see all commands.`, threadID, messageID);
    }
    const msg = [
      `Command: ${found.name}`,
      `Description: ${found.description || "No description"}`,
      `Usage: ${prefix}${found.usage || found.name}`,
      `Role: ${found.role == 0 ? "Everyone" : found.role == 1 ? "Admin" : "Developer"}`,
      `Cooldown: ${found.cooldown || 5}s`,
      `Credits: ${found.credits || "Unknown"}`,
      found.aliases?.length ? `Aliases: ${found.aliases.join(", ")}` : null
    ].filter(Boolean).join("\n");
    return api.sendMessage(msg, threadID, messageID);
  }

  const cmdList = Array.from(Utils.commands.values());
  const lines = cmdList.map((c, i) => `${i + 1}. ${prefix}${c.name} - ${c.description || "No description"}`);
  const msg = `Available Commands (${cmdList.length}):\n\n${lines.join("\n")}\n\nType ${prefix}help [command] for details.`;
  return api.sendMessage(msg, threadID, messageID);
};
