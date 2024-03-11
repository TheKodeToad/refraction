use crate::{api, Data};

use eyre::{Report, Result};
use log::{debug, info, trace};
use poise::serenity_prelude::{ActivityData, Context, FullEvent, OnlineStatus};
use poise::FrameworkContext;

mod analyze_logs;
mod delete_on_reaction;
mod eta;
pub mod pluralkit;
mod starboard;
mod support_onboard;

pub async fn handle(
	ctx: &Context,
	event: &FullEvent,
	_framework: FrameworkContext<'_, Data, Report>,
	data: &Data,
) -> Result<()> {
	match event {
		FullEvent::Ready { data_about_bot } => {
			info!("Logged in as {}!", data_about_bot.user.name);

			let latest_minecraft_version = api::prism_meta::get_latest_minecraft_version().await?;
			let activity = ActivityData::playing(format!("Minecraft {latest_minecraft_version}"));

			info!("Setting presence to activity {activity:#?}");
			ctx.set_presence(Some(activity), OnlineStatus::Online);
		}

		FullEvent::Message { new_message } => {
			// ignore new messages from bots
			// note: the webhook_id check allows us to still respond to PK users
			if new_message.author.bot && new_message.webhook_id.is_none() {
				trace!("Ignoring message {} from bot", new_message.id);
				return Ok(());
			}

			// detect PK users first to make sure we don't respond to unproxied messages
			pluralkit::handle(ctx, new_message, data).await?;

			if data.storage.is_user_plural(new_message.author.id).await?
				&& pluralkit::is_message_proxied(new_message).await?
			{
				debug!("Not replying to unproxied PluralKit message");
				return Ok(());
			}

			eta::handle(ctx, new_message).await?;
			analyze_logs::handle(ctx, new_message, data).await?;
		}

		FullEvent::ReactionAdd { add_reaction } => {
			delete_on_reaction::handle(ctx, add_reaction).await?;
			starboard::update(
				ctx,
				add_reaction.guild_id,
				&ctx.http
					.get_message(add_reaction.channel_id, add_reaction.message_id)
					.await?,
				data,
			)
			.await?;
		}

		FullEvent::ReactionRemove { removed_reaction } => {
			starboard::update(
				ctx,
				removed_reaction.guild_id,
				&ctx.http
					.get_message(removed_reaction.channel_id, removed_reaction.message_id)
					.await?,
				data,
			)
			.await?;
		}

		FullEvent::ReactionRemoveEmoji { removed_reactions } => {
			starboard::update(
				ctx,
				removed_reactions.guild_id,
				&ctx.http
					.get_message(removed_reactions.channel_id, removed_reactions.message_id)
					.await?,
				data,
			)
			.await?;
		}

		FullEvent::ThreadCreate { thread } => {
			support_onboard::handle(ctx, thread).await?;
		}

		_ => {}
	}

	Ok(())
}
