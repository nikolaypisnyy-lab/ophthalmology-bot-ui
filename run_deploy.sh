export PATH="/opt/homebrew/bin:$PATH"
eval $(ssh-agent -s)
ssh-add ~/.ssh/id_ed25519_refmaster
bash deploy_standard.sh
