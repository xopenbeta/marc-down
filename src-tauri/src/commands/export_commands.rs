use std::io::Cursor;

#[tauri::command]
pub async fn export_epub(
    title: String,
    html_content: String,
    output_path: String,
) -> Result<(), String> {
    use epub_builder::{EpubBuilder, EpubContent, ZipLibrary};

    let mut builder = EpubBuilder::new(ZipLibrary::new().map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;

    builder
        .metadata("title", &title)
        .map_err(|e| e.to_string())?;

    let xhtml = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>{}</title></head>
<body>{}</body>
</html>"#,
        title, html_content
    );

    builder
        .add_content(
            EpubContent::new("chapter.xhtml", Cursor::new(xhtml.as_bytes().to_vec()))
                .title(&title),
        )
        .map_err(|e| e.to_string())?;

    let mut output = Vec::new();
    builder
        .generate(&mut Cursor::new(&mut output))
        .map_err(|e| e.to_string())?;

    std::fs::write(&output_path, &output).map_err(|e| e.to_string())?;

    Ok(())
}
