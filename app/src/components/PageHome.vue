<script setup>
import { ref, watchEffect } from "vue";
import { fetchTweets } from "@/api";
import TweetForm from "@/components/TweetForm";
import TweetList from "@/components/TweetList";
import { useWallet } from "solana-wallets-vue";

const tweets = ref([]);
const loading = ref(true);
const { connected } = useWallet();
watchEffect(() =>
  connected.value
    ? fetchTweets()
        .then((fetchedTweets) => (tweets.value = fetchedTweets))
        .finally(() => (loading.value = false))
    : null
);

const addTweet = (tweet) => tweets.value.push(tweet);
</script>

<template>
  <tweet-form @added="addTweet"></tweet-form>
  <tweet-list :tweets="tweets" :loading="loading"></tweet-list>
</template>
