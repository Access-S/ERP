#!/bin/bash
# ================================================================
# update-structure.sh — Next.js Monolith Structure Generator
# Usage: bash update-structure.sh
# ================================================================

# Fix Unicode encoding for Git Bash / MINGW
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

OUTPUT_FILE="project-structure.txt"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

file_count=0
dir_count=0

print_tree() {
    local dir="$1"
    local prefix="$2"
    local dirs=()
    local files=()

    while IFS= read -r name; do
        [ -z "$name" ] && continue
        local path="$dir/$name"

        # Ignore Next.js/Node specific build and system folders
        case "$name" in
            node_modules|.git|.next|dist|build|coverage|.DS_Store|.vscode|.idea) continue ;;
        esac

        if [ -d "$path" ]; then
            dirs+=("$path")
        else
            files+=("$path")
        fi
    done < <(ls -1A "$dir" 2>/dev/null)

    local items=("${dirs[@]}" "${files[@]}")
    local total=${#items[@]}
    local i=0

    for item in "${items[@]}"; do
        i=$((i + 1))
        local name=$(basename "$item")

        if [ "$i" -eq "$total" ]; then
            local branch="└── "
            local child_prefix="${prefix}    "
        else
            local branch="├── "
            local child_prefix="${prefix}│   "
        fi

        if [ -d "$item" ]; then
            dir_count=$((dir_count + 1))

            # Check if directory is empty
            local child_count
            child_count=$(ls -1A "$item" 2>/dev/null | wc -l)

            if [ "$child_count" -eq 0 ]; then
                echo "${prefix}${branch}${name}/  (empty)"
            else
                echo "${prefix}${branch}${name}/"
                print_tree "$item" "$child_prefix"
            fi
        else
            file_count=$((file_count + 1))
            local icon=""
            case "$name" in
                *.ts|*.tsx)        icon="[TS]   " ;;
                *.js|*.jsx)        icon="[JS]   " ;;
                *.css)             icon="[CSS]  " ;;
                *.md)              icon="[MD]   " ;;
                *.json)            icon="[JSON] " ;;
                *.html)            icon="[HTML] " ;;
                *.yaml|*.yml)      icon="[YAML] " ;;
                .env*|*.env)       icon="[ENV]  " ;;
                *.sh)              icon="[SH]   " ;;
                *.svg|*.png|*.jpg) icon="[IMG]  " ;;
                *.txt)             icon="[TXT]  " ;;
                *.prisma)          icon="[PRISMA]" ;;
                *)                 icon="       " ;;
            esac
            echo "${prefix}${branch}${icon}${name}"
        fi
    done
}

# ======================== GENERATE OUTPUT ========================

{
    echo "+----------------------------------------------------------+"
    echo "|                                                          |"
    echo "|          NEXT.JS             |"
    echo "|          mrp-system                                      |"
    echo "|                                                          |"
    echo "|          Generated: $TIMESTAMP                  |"
    echo "|                                                          |"
    echo "+----------------------------------------------------------+"
    echo ""
    echo "  mrp-system/"
    echo "  |"
    print_tree "." "  "
    echo ""
    echo "+----------------------------------------------------------+"
    printf "|  SUMMARY:  Folders: %-4s | Files: %-4s | Total: %-7s  |\n" \
        "$dir_count" "$file_count" "$((dir_count + file_count))"
    echo "+----------------------------------------------------------+"
} > "$OUTPUT_FILE"

# Terminal feedback
echo ""
echo "  ✅ Project structure saved to $OUTPUT_FILE"
echo ""
echo "  ┌─────────────────────────────────────┐"
printf "  │  📂 Folders:  %-22s │\n" "$dir_count"
printf "  │  📄 Files:    %-22s │\n" "$file_count"
printf "  │  📦 Total:    %-22s │\n" "$((dir_count + file_count))"
echo "  └─────────────────────────────────────┘"
echo ""