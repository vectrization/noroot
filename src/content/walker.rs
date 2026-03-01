//please ignore. This is just placeholder content to test codeblocks.

use std::fs;
use std::path::{Path, PathBuf};
use serde::{Serialize, Deserialize};
use serde_json::{Value, from_value, to_value};
use gray_matter::{Matter, ParsedEntity, engine::YAML};

#[derive(Serialize)]
pub enum FileEntry {
    Dir(Dir),
    Markdown(MarkdownFile),
    Asset(AssetFile)
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PageConfig {
    //stuff here ill decide later
    pub layout: Option<String>,
    pub theme: Option<String>,
    pub file_path: Option<String>,
    pub file_name: Option<String>,
    pub navbar_contents: Option<String>,
    pub toc_contents: Option<String>,
    pub meta_description: Option<String>,
    pub primary_color: Option<String>,
    pub secondary_color: Option<String>,
    pub status: Option<String>,
    pub tags: Option<Vec<String>>,
    pub updates: Option<Vec<String>>, //csv containing unixepochtimestamps. The first one is creation date for the markdown.
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub author: Option<String>,
    pub contributors: Option<Vec<String>>,
}

#[derive(Serialize)]
pub struct Dir {
    pub path: String,
    pub config: Option<PageConfig>,
    pub contents: Vec<FileEntry>
}

#[derive(Serialize)]
pub struct MarkdownFile {
    pub file_name: String,
    pub path: String,
    pub config: Option<PageConfig>,
    pub contents: String
}

#[derive(Serialize)]
pub struct AssetFile {
    pub file_name: String,
    pub file_ext: String,
    pub path: String,
    pub config: PageConfig
}

fn list_dir_contents(path: &PathBuf) -> Vec<PathBuf> {
    fs::read_dir(path)
        .unwrap()
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .collect()
}

fn merge_configs(parent: &PageConfig, child: &PageConfig) -> PageConfig {
    let mut p: Value = to_value(parent).unwrap();
    let c: Value = to_value(child).unwrap();

    if let (Value::Object(p_map), Value::Object(c_map)) = (&mut p, c) {
        for (k, v) in c_map {
            if !v.is_null() {
                p_map.insert(k, v);
            }
        }
    }

    from_value(p).unwrap()
}

fn parse_conf_file(path: &PathBuf, parent_config: &Option<PageConfig>) -> PageConfig {
    let content = fs::read_to_string(path).unwrap_or_default();

    let matter = Matter::<YAML>::new();
    let result: ParsedEntity<PageConfig> = matter.parse::<PageConfig>(&content).unwrap();
    let data = result.data.unwrap_or_default();
    merge_configs(&parent_config.clone().unwrap_or_default(), &data)
}
fn parse_md(path: &PathBuf, vault_root: &Path, parent_config: Option<PageConfig>) -> MarkdownFile {
    let content = fs::read_to_string(path).unwrap_or_default();

    let matter = Matter::<YAML>::new();
    let result: ParsedEntity<PageConfig> = matter.parse::<PageConfig>(&content).unwrap();

    let parent = parent_config.unwrap_or_default();
    let child = result.data.unwrap_or_default();

    // clone the path so we can mutate it (remove extension) without borrowing the original as mutable
    let mut path_no_ext = path.clone();
    path_no_ext.set_extension("");
    let rel_path = path_no_ext.strip_prefix(vault_root).unwrap_or(&path_no_ext);

    MarkdownFile {
        file_name: path_no_ext.file_name().unwrap().to_string_lossy().to_string(),
        path: rel_path.to_string_lossy().to_string(),
        config: Some(merge_configs(&parent, &child)),
        contents: result.content
    }
}

fn parse_file(path: &PathBuf, vault_root: &Path, parent_config: Option<PageConfig>) -> AssetFile {
    let rel_path = path.strip_prefix(vault_root).unwrap_or(path);
    AssetFile {
        file_name: path.file_name().unwrap().to_string_lossy().to_string(),
        file_ext: path.extension().unwrap().to_string_lossy().to_string(),
        path: rel_path.to_string_lossy().to_string(),
        config: parent_config.clone().unwrap()
    }
}
 
pub fn walk_dir(path: PathBuf, vault_root: &Path, parent_config: Option<PageConfig>) -> Dir {
    let mut dir_config = parent_config.clone();

    //scan for conf
    for f in list_dir_contents(&path) {
        let file_name = f.file_name().unwrap().to_str().unwrap();
        if (file_name.starts_with("_") || file_name.starts_with(".")) && file_name.contains("conf") {
            let conf = parse_conf_file(&f, &parent_config);
            dir_config = Some(conf);
            println!("Resolving conf for {}", path.display());
            //print!("\r\033[KResolving conf for {}", path.display());
            break;
        };
    };

    let rel_path = relative_path(vault_root, &path);

    let mut dir_object = Dir {
        path: rel_path.to_string_lossy().to_string(),
        config: dir_config.clone(),
        contents: Vec::new(),
    };

    for f in list_dir_contents(&path) {
        let file_name = f.file_name().unwrap().to_str().unwrap();
        if file_name.starts_with(".") || file_name.starts_with("_") { continue; }

        if f.is_dir() {
            dir_object.contents.push(FileEntry::Dir(walk_dir(f, vault_root, dir_config.clone())));
        } else if f.extension().and_then(|ext| ext.to_str()) == Some("md") {
            let md_file = parse_md(&f, vault_root, dir_config.clone());
            dir_object.contents.push(FileEntry::Markdown(md_file));
        } else {
            dir_object.contents.push(FileEntry::Asset(parse_file(&f, vault_root, dir_config.clone())));
        };
    };

    dir_object
}

fn relative_path<'a>(base: &'a Path, target: &'a Path) -> PathBuf {
    target.strip_prefix(base).unwrap_or(target).to_path_buf()
}

pub fn _serialize_dir_to_json(dir: &Dir, output_path: &str) {
    let json = serde_json::to_string_pretty(dir).unwrap();
    fs::write(output_path, json).unwrap();
}