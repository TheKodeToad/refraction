use std::{any::Any, str::FromStr};

use eyre::{eyre, OptionExt, Result};
use log::{debug, trace};
use poise::serenity_prelude::{
	ChannelId, Context, CreateAllowedMentions, CreateButton, CreateEmbed, CreateEmbedAuthor,
	CreateMessage, EditMessage, GuildId, Mentionable, Message, MessageId, MessageReaction,
	MessageType, ReactionType,
};

use crate::{consts::COLORS, Data};

const REACTIONS: &[&str] = &["⭐", "🐌", "1033546960067629077"];
const REACTION_THRESHOLD: u64 = 2;

pub async fn update(
	ctx: &Context,
	source_guild_id: Option<GuildId>,
	source: &Message,
	data: &Data,
) -> Result<()> {
	let Some(source_guild_id) = source_guild_id else {
		trace!("Ignoring message outside of any guild");
		return Ok(());
	};

	let Some(target_channel_id) = data.config.discord.channels().starboard_channel_id() else {
		trace!("Ignoring message in starboard channel");
		return Ok(());
	};

	if let Some(target_channel) = ctx.cache.channel(target_channel_id) {
		if source_guild_id != target_channel.guild_id {
			trace!("Ignoring message outside of starboard guild");
			return Ok(());
		}
	} else {
		return Err(eyre!(
			"Cannot find starboard channel ({}) in cache",
			target_channel_id
		));
	}

	if source.channel_id == target_channel_id {
		return Ok(());
	}

	let matches: Vec<&MessageReaction> = source
		.reactions
		.iter()
		.filter(|r| {
			let id = match &r.reaction_type {
				ReactionType::Custom {
					animated: _,
					id,
					name: _,
				} => id.to_string(),
				ReactionType::Unicode(str) => str.to_string(),
				_ => todo!(),
			};

			REACTIONS.contains(&id.as_str()) && r.count >= REACTION_THRESHOLD
		})
		.collect();

	let current_post = data
		.storage
		.get_starboard_post(&source.id.to_string())
		.await?
		.map(|id| MessageId::from_str(&id).ok())
		.unwrap_or_default();

	if matches.is_empty() {
		if let Some(current_post_id) = current_post {
			debug!(
				"{} no longer meets starboard requiements; attempting to delete the post: {}",
				source.id, current_post_id
			);

			data.storage
				.delete_starboard_post(&source.id.to_string())
				.await?;

			// ignore error deleting, the message was probably already gone
			let _ = target_channel_id
				.delete_message(&ctx.http, current_post_id)
				.await;
		}

		return Ok(());
	}

	let mut embed = CreateEmbed::new();

	embed = embed.color(COLORS["yellow"]);

	if source.webhook_id.is_some() {
		embed =
			embed.author(CreateEmbedAuthor::new(source.author.name.clone()).icon_url(
				source.author.avatar_url().unwrap_or_else(|| {
					"https://cdn.discordapp.com/embed/avatars/0.png".to_string()
				}),
			));
	} else {
		let member = ctx
			.http
			.get_member(source_guild_id, source.author.id)
			.await?;

		embed = embed.author(
			CreateEmbedAuthor::new(member.display_name())
				.icon_url(
					member
						.avatar_url()
						.or_else(|| source.author.avatar_url())
						.unwrap_or_else(|| source.author.default_avatar_url()),
				)
				.url(format!("https://discord.com/users/{}", source.author.id)),
		);
	}

	embed = embed.description(format_content(ctx, source_guild_id, source, false)?);

	if let Some(image) = source
		.attachments
		.iter()
		.filter(|a| {
			a.content_type
				.as_ref()
				.map(|ct| ct.starts_with("image/"))
				.unwrap_or(false)
		})
		.next()
	{
		embed = embed.image(&image.url);
	} else if let Some(image) = source
		.embeds
		.iter()
		.filter(|e| e.kind.as_ref().map(|k| k == "image").unwrap_or(false)) // FIXME usage of embed type is deprecated
		.next()
	{
		embed = embed.image(
			image
				.url
				.as_ref()
				.ok_or_eyre("Missing image URL in embed")?,
		);
	}

	let content = format!(
		"**{}** in {}",
		matches
			.iter()
			.map(|reaction| format!("{} {}", reaction.reaction_type.to_string(), reaction.count))
			.collect::<Vec<String>>()
			.join("  "),
		source.channel_id.mention(),
	);

	if let Some(current_post_id) = current_post {
		let result = target_channel_id
			.edit_message(
				&ctx.http,
				current_post_id,
				EditMessage::new()
					.content(content.clone())
					.embed(embed.clone())
					.allowed_mentions(CreateAllowedMentions::new()),
			)
			.await;

		if result.is_ok() {
			return Ok(());
		}

		debug!("Editing message failed, posting a new one");

		// in case the send fails
		data.storage
			.delete_starboard_post(&source.id.to_string())
			.await?;
	}

	let new_post = target_channel_id
		.send_message(
			&ctx.http,
			CreateMessage::new()
				.content(content.clone())
				.embed(embed.clone())
				.button(
					CreateButton::new_link(jump_url(
						Some(source_guild_id),
						source.channel_id,
						Some(source.id),
					))
					.label("Original Message"),
				)
				.allowed_mentions(CreateAllowedMentions::new()),
		)
		.await?;

	data.storage
		.store_starboard_post(&source.id.to_string(), &new_post.id.to_string())
		.await?;

	Ok(())
}

fn jump_url(
	guild_id: Option<GuildId>,
	channel_id: ChannelId,
	message_id: Option<MessageId>,
) -> String {
	let mut result = "https://discord.com/channels".to_string();

	if let Some(guild_id) = guild_id {
		result += "/";
		result += &guild_id.to_string();
	}

	result += "/";
	result += &channel_id.to_string();

	if let Some(message_id) = message_id {
		result += "/";
		result += &message_id.to_string();
	}

	result
}

fn format_content(
	ctx: &Context,
	guild_id: GuildId,
	message: &Message,
	quote: bool,
) -> Result<String> {
	match message.kind {
		MessageType::Regular
		| MessageType::InlineReply
		| MessageType::ChatInputCommand
		| MessageType::ContextMenuCommand => {
			let mut result = String::new();

			if quote {
				result += &format!("{}: ", message.author.mention());
			} else if let Some(referenced_message) = message.referenced_message.as_ref() {
				result += &format!(
					"> {}\n\n",
					format_content(ctx, guild_id, referenced_message, true)?
				);
			} else if message.message_reference.is_some() {
				result += "> *Original message was deleted*\n\n";
			} else if let Some(interaction) = message.interaction.as_ref() {
				let name = if message.kind == MessageType::ContextMenuCommand {
					format!("/{}", interaction.name)
				} else {
					interaction.name.clone()
				};

				result += &format!("> {} used {}\n\n", interaction.user.mention(), name);
			}

			if !message.content.is_empty() {
				result += &message.content;
			} else if quote && !message.sticker_items.is_empty() {
				result += &format!(
					"📎 *[Click to see sticker]({})*",
					jump_url(Some(guild_id), message.channel_id, Some(message.id))
				);
			} else if (quote && !message.attachments.is_empty()) || !message.embeds.is_empty() {
				result += &format!(
					"📎 *[Click to see attachment]({})*",
					jump_url(Some(guild_id), message.channel_id, Some(message.id))
				);
			}

			Ok(result)
		}

		MessageType::PinsAdd => {
			let message_reference = message
				.message_reference
				.as_ref()
				.ok_or_eyre("Missing reference")?;

			Ok(format!(
				"{} pinned [a message]({}) to {}",
				message.author.mention(),
				jump_url(
					Some(guild_id),
					message_reference.channel_id,
					message_reference.message_id
				),
				message_reference.channel_id.mention()
			))
		}

		MessageType::MemberJoin => {
			let mention = message.author.mention();

			Ok(match message.timestamp.timestamp_millis() % 13 {
				0 => format!("{mention} joined the party."),
				1 => format!("{mention} is here."),
				2 => format!("Welcome, {mention}. We hope you've brought pizza."),
				3 => format!("A wild {mention} appeared."),
				4 => format!("{mention} just landed."),
				5 => format!("{mention} just slid into the server."),
				6 => format!("{mention} just showed up!"),
				7 => format!("Welcome {mention}. Say hi!"),
				8 => format!("{mention} hopped into the server."),
				9 => format!("Everyone welcome {mention}!"),
				10 => format!("Glad you're here, {mention}."),
				11 => format!("Good to see you, {mention}."),
				12 => format!("Yay you made it, {mention}!"),
				_ => unreachable!(),
			})
		}

		MessageType::NitroBoost => Ok(format!("{} just Boosted the server!", message.author)),

		MessageType::NitroTier1 | MessageType::NitroTier2 | MessageType::NitroTier3 => {
			let mention = message.author.mention();
			let guild_name = &message
				.guild(&ctx.cache)
				.ok_or_eyre("Guild is not cached")?
				.name;
			let level = match message.kind {
				MessageType::NitroTier1 => 1,
				MessageType::NitroTier2 => 2,
				MessageType::NitroTier3 => 3,
				_ => unreachable!(),
			};
			Ok(format!(
				"{mention} just Boosted the server! {guild_name} has reached **Level {level}!**"
			))
		}

		MessageType::ThreadCreated => {
			let message_reference = message
				.message_reference
				.as_ref()
				.ok_or_eyre("Missing reference")?;

			Ok(format!(
				"{} started a thread: <#{}>.",
				message.author.mention(),
				message_reference.channel_id
			))
		}

		_ => Ok("❓ Unrecognized message type".to_string()),
	}
}
