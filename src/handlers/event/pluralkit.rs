use crate::{
	api::{self, HttpClient},
	storage::Storage,
};

use std::time::Duration;

use eyre::Result;
use log::{debug, trace};
use poise::serenity_prelude::{Context, Message};
use tokio::time::sleep;

const PK_DELAY: Duration = Duration::from_secs(1);

pub async fn is_message_proxied(http: &HttpClient, message: &Message) -> Result<bool> {
	trace!(
		"Waiting on PluralKit API for {} seconds",
		PK_DELAY.as_secs()
	);
	sleep(PK_DELAY).await;

	let proxied = api::pluralkit::sender_from(http, message.id).await.is_ok();

	Ok(proxied)
}

pub async fn handle(
	_: &Context,
	http: &HttpClient,
	storage: &Storage,
	msg: &Message,
) -> Result<()> {
	if msg.webhook_id.is_none() {
		return Ok(());
	}

	debug!(
		"Message {} has a webhook ID. Checking if it was sent through PluralKit",
		msg.id
	);

	trace!(
		"Waiting on PluralKit API for {} seconds",
		PK_DELAY.as_secs()
	);
	sleep(PK_DELAY).await;

	if let Ok(sender) = api::pluralkit::sender_from(http, msg.id).await {
		storage.store_user_plurality(sender).await?;
	}

	Ok(())
}
