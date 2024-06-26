use crate::api::{paste_gg, HttpClient};

use std::sync::OnceLock;

use eyre::{OptionExt, Result};
use log::trace;
use poise::serenity_prelude::Message;
use regex::Regex;

pub struct PasteGG;

impl super::LogProvider for PasteGG {
	async fn find_match(&self, message: &Message) -> Option<String> {
		static REGEX: OnceLock<Regex> = OnceLock::new();
		let regex = REGEX.get_or_init(|| Regex::new(r"https://paste.gg/p/\w+/(\w+)").unwrap());

		trace!("Checking if message {} is a paste.gg paste", message.id);
		super::get_first_capture(regex, &message.content)
	}

	async fn fetch(&self, http: &HttpClient, content: &str) -> Result<String> {
		let files = paste_gg::files_from(http, content).await?;
		let result = files
			.result
			.ok_or_eyre("Got an empty result from paste.gg!")?;

		let file_id = result
			.iter()
			.map(|f| f.id.as_str())
			.nth(0)
			.ok_or_eyre("Couldn't get file id from empty paste.gg response!")?;

		let log = paste_gg::get_raw_file(http, content, file_id).await?;

		Ok(log)
	}
}
