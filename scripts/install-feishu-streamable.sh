#!/bin/bash
# 自定义飞书插件安装脚本（用户魔改版）
# 功能：安装 feishu-streamable channel，保留官方 feishu
# 
# 使用方式:
#   ./install-feishu-streamable.sh           # 交互模式
#   ./install-feishu-streamable.sh --app-id XXX --app-secret XXX  # 非交互模式

set -e

# ====== 配置区域 ======
CHANNEL_NAME="feishu-streamable"                              # 你的 channel 名字
PLUGIN_NAME="feishu-streamable"                               # 插件目录名（对应 plugins.entries）
PACKAGE_NAME="@picpic2013/feishu-streamable"                  # npm 包名
# 开发时使用本地路径:
# LOCAL_PLUGIN_PATH="/root/.openclaw/extensions/feishu-openclaw-plugin-custom"

# 是否禁用官方 feishu 插件（false = 保留官方）
DISABLE_OFFICIAL=false

# 你的 channel 默认配置（包含 instantCard 等增强功能）
STREAMING=true
RENDER_MODE="card"
INSTANT_CARD=true
GROUP_STREAMING=true
MULTI_MESSAGE_STREAMING=true

OPENCLAW_MIN_VERSION="2026.2.26"
# =======================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# 获取 OpenClaw 目录
get_openclaw_dir() {
    echo "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
}

get_config_path() {
    echo "$(get_openclaw_dir)/openclaw.json"
}

get_extensions_dir() {
    echo "$(get_openclaw_dir)/extensions"
}

# 读取配置
read_config() {
    local config_path=$(get_config_path)
    if [ -f "$config_path" ]; then
        cat "$config_path"
    else
        echo "{}"
    fi
}

# 写入配置
write_config() {
    local config_path=$(get_config_path)
    mkdir -p "$(dirname "$config_path")"
    echo "$1" > "$config_path"
}

# 比较版本
version_compare() {
    local v1=$1 v2=$2
    if [ "$v1" = "$v2" ]; then return 0; fi
    
    local IFS=.
    local i ver1=($v1) ver2=($v2)
    
    for ((i=0; i<${#ver1[@]} || i<${#ver2[@]}; i++)); do
        local num1=${ver1[i]:-0}
        local num2=${ver2[i]:-0}
        
        if ((10#$num1 > 10#$num2)); then return 0; fi
        if ((10#$num1 < 10#$num2)); then return 1; fi
    done
    return 0
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --app-id)
                APP_ID="$2"
                shift 2
                ;;
            --app-secret)
                APP_SECRET="$2"
                shift 2
                ;;
            --channel)
                CHANNEL_NAME="$2"
                shift 2
                ;;
            --local)
                USE_LOCAL=true
                LOCAL_PLUGIN_PATH="$2"
                shift 2
                ;;
            -h|--help)
                echo "用法: $0 [选项]"
                echo ""
                echo "选项:"
                echo "  --app-id ID        飞书 App ID"
                echo "  --app-secret SEC   飞书 App Secret"
                echo "  --channel NAME     Channel 名字 (默认: feishu-streamable)"
                echo "  --local PATH       使用本地插件路径（开发时）"
                echo "  -h, --help         显示此帮助"
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                exit 1
                ;;
        esac
    done
}

# 主流程
main() {
    parse_args "$@"
    
    log_info "========================================"
    log_info "  飞书流式输出插件安装脚本 (feishu-streamable)"
    log_info "========================================"
    log_info "Channel 名称: $CHANNEL_NAME"
    log_info "插件名称: $PLUGIN_NAME"
    log_info "包名: $PACKAGE_NAME"
    log_info ""
    
    # 1. 检查 OpenClaw 版本
    log_step "1/7 检查 OpenClaw 版本..."
    if ! command -v openclaw &> /dev/null; then
        log_error "OpenClaw 未安装或不在 PATH 中"
        exit 1
    fi
    
    local version=$(openclaw --version 2>&1 | grep -oP '\d+\.\d+\.\d+' | head -1)
    if [ -z "$version" ]; then
        log_warn "无法解析 OpenClaw 版本"
    elif ! version_compare "$version" "$OPENCLAW_MIN_VERSION"; then
        log_error "OpenClaw 版本过低。需要 >= $OPENCLAW_MIN_VERSION，当前 $version"
        exit 1
    fi
    log_info "OpenClaw 版本: $version ✓"

    # 7. 安装插件
    log_step "2/7 安装插件..."
    
    if [ "$USE_LOCAL" = true ] && [ -n "$LOCAL_PLUGIN_PATH" ]; then
        # 使用本地路径
        local extensions_dir=$(get_extensions_dir)
        local plugin_path="$extensions_dir/$PLUGIN_NAME"
        log_info "链接本地插件: $LOCAL_PLUGIN_PATH -> $plugin_path"
        mkdir -p "$extensions_dir"
        rm -rf "$plugin_path"
        ln -s "$LOCAL_PLUGIN_PATH" "$plugin_path"
    elif [ -n "$PACKAGE_NAME" ]; then
        # 从 npm 安装
        local extensions_dir=$(get_extensions_dir)
        local plugin_path="$extensions_dir/$PLUGIN_NAME"

        if [ -d "$plugin_path" ]; then
            log_info "插件 $PLUGIN_NAME 已存在于 $plugin_path，跳过安装。"
        else
            log_info "从 npm 安装: $PACKAGE_NAME"
            openclaw plugins install "$PACKAGE_NAME"
        fi
    fi
    
    # 2. 获取 app 配置（交互或命令行）
    log_step "3/7 获取飞书 App 凭证..."
    if [ -z "$APP_ID" ]; then
        log_info "请输入飞书 App ID:"
        read -r APP_ID
    fi
    if [ -z "$APP_ID" ]; then
        log_error "App ID 不能为空"
        exit 1
    fi
    
    if [ -z "$APP_SECRET" ]; then
        log_info "请输入飞书 App Secret:"
        read -r APP_SECRET
    fi
    if [ -z "$APP_SECRET" ]; then
        log_error "App Secret 不能为空"
        exit 1
    fi
    log_info "App ID: $APP_ID ✓"
    
    # 3. 读取现有配置
    log_step "4/7 读取现有配置..."
    local config_json=$(read_config)
    log_info "读取现有配置 ✓"
    
    # 4. 构建 channel 配置（包含你的增强功能）
    log_step "5/7 构建 channel 配置..."
    
    local new_channel_config=$(cat <<EOF
{
    "enabled": true,
    "appId": "$APP_ID",
    "appSecret": "$APP_SECRET",
    "domain": "$CHANNEL_NAME",
    "connectionMode": "websocket",
    "requireMention": true,
    "dmPolicy": "open",
    "groupPolicy": "open",
    "allowFrom": ["*"],
    "groupAllowFrom": [],
    "streaming": $STREAMING,
    "renderMode": "$RENDER_MODE",
    "typingIndicator": true,
    "groupStreaming": $GROUP_STREAMING,
    "multiMessageStreaming": $MULTI_MESSAGE_STREAMING,
    "streamingThrottleMs": 3000,
    "streamingBatchMs": 50,
    "thinkingRolloverChars": 20000,
    "thinkingRolloverEnabled": true,
    "thinkingAccumulateEnabled": true,
    "instantCard": $INSTANT_CARD,
    "footer": {
        "elapsed": true,
        "status": true
    }
}
EOF
)
    log_info "Channel 配置构建完成 ✓"
    
    # 5. 合并配置
    log_step "6/7 合并配置..."
    
    if command -v jq &> /dev/null; then
        # 使用 jq 合并配置
        config_json=$(echo "$config_json" | jq \
            --arg channel "$CHANNEL_NAME" \
            --argjson channel_config "$new_channel_config" \
            '
            # 添加 channel
            .channels[$channel] = $channel_config |
            # 确保 plugins 结构存在
            if .plugins == null then .plugins = {} else . end |
            if .plugins.allow == null then .plugins.allow = [] else . end |
            if .plugins.entries == null then .plugins.entries = {} else . end |
            # 添加插件到 allow 列表（不重复）
            .plugins.allow += ["'"$PLUGIN_NAME"'"] | .plugins.allow = (.plugins.allow | unique) |
            # 启用插件
            .plugins.entries["'"$PLUGIN_NAME"'"] = {"enabled": true}
            '
        )
        log_info "配置合并完成 (jq) ✓"
    else
        log_warn "jq 未安装，使用简单配置覆盖"
        # 简单处理：只更新 channel 部分
        config_json=$(echo "$config_json" | sed 's/"channels": {/"channels": {\n    "'"$CHANNEL_NAME"'": '"$new_channel_config"'/,/')
        # 这个简化版本可能不太准确，建议安装 jq
    fi
    
    # 6. 写入配置
    log_step "7/7 写入配置..."
    write_config "$config_json"
    log_info "配置写入: $(get_config_path) ✓"
    
    
    
    log_info "插件安装完成 ✓"
    
    # 8. 重启 gateway
    log_step "重启 OpenClaw gateway..."
    openclaw gateway restart
    
    # 9. 健康检查
    sleep 3
    if openclaw health --json 2>&1 | grep -q '"ok":true'; then
        log_info ""
        log_info "========================================"
        log_info "  ✅ 安装成功！"
        log_info "========================================"
        log_info ""
        log_info "Channel '$CHANNEL_NAME' 已配置"
        log_info ""
        log_info "使用方式："
        log_info "  openclaw gateway start"
        log_info "  然后在飞书中搜索你的机器人并开始聊天"
    else
        log_warn ""
        log_warn "安装完成，但健康检查未通过"
        log_warn "请运行 'openclaw doctor' 诊断问题"
    fi
}

main "$@"
