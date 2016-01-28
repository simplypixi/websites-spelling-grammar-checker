var Spellchecker = require("hunspell-spellchecker");
var Promise = require('bluebird');
var fs = require("fs");
var websites = process.argv.slice(2);//['pudelek.pl'];
var Crawler = require("simplecrawler");
var request = require('request-promise');
var request2 = require('request');
request2 = Promise.promisifyAll(request2);
var cheerio = require('cheerio');

var spellchecker = new Spellchecker();
console.log("Ładowanie słownika...");
var DICT = spellchecker.parse({
    aff: fs.readFileSync("./dict/polish.aff"),
    dic: fs.readFileSync("./dict/polish.dic")
});
console.log("Słownik załadowany");
spellchecker.use(DICT);

var websitesPromises = websites.map(function(website){
	return request('http://' + website);
});


console.log("Get addresses on websites")
Promise.all(websitesPromises).then(function(results){
	var addressesPerWebsite = [];
	results.forEach(function(website, index){
		var tmp = [];
		$ = cheerio.load(website);
		$('a').each(function(index, address) {
			var link = $(this).attr('href');
			if((link.indexOf('.html') > -1 || link.indexOf('/artykul/') > -1) && link.indexOf('#') == -1 && link.indexOf('kategoria.html') == -1 && tmp.indexOf(link) == -1){
				tmp.push(link);
				if(tmp.length === 5){
					return false;
				}
			}
		});
		addressesPerWebsite.push(tmp);
	});

	console.log("Reading websites");
	var addressesPerWebsitePromises = addressesPerWebsite.map(function(websiteAddresses, index){
		return websiteAddresses.map(function(address){
			if(address.indexOf('http:') > -1  || address.indexOf('https:') > -1){
				return request({
						    uri: address
						});
			} else {
				var protocol = 'http://'+websites[index];
				address = address[0] !== '/' ? '/'+address : address;
				return request({
						    uri: protocol + address
						});
			}
		});
	});

	addressesPerWebsitePromises = [].concat.apply([], addressesPerWebsitePromises);
	console.log("Checking mistakes");
	Promise.all(addressesPerWebsitePromises).then(function(pages){
		var mistakes = {};
		var currentPage = 0;
		mistakes[websites[currentPage]] = {
			fails: [],
			count: 0
		}

		pages.forEach(function(page, index){
	        $ = cheerio.load(page);
	        $('p').each(function(paragraph) {
	            var words = $(this).children().remove().end()
	            .text().toString("utf8").trim().replace(/(?:\r\n|\r|\n)/g, ' ').replace(/\s\s+/g, ' ').replace(/[`~!@#$%^&*()_|+\–\-=?;:'”"„,.<>\{\}\[\]\\\/]/g, '').split(' ');
	            words.filter(function(word){
	            	return word.length > 4;
	            }).forEach(function(word){
	            	if(!spellchecker.check(word) && mistakes[websites[currentPage]].fails.indexOf(word) == -1 && word[0] !== word[0].toUpperCase()){
	            		mistakes[websites[currentPage]].count++;
	            		mistakes[websites[currentPage]].fails.push(word);
	            	}
	            });
	        });
			if(index%5 === 0 && index !== 0 && currentPage !== websites.length){
				currentPage++;
				mistakes[websites[currentPage]] = {
					fails: [],
					count: 0
				}
			}
		})
		console.log("===== SCORE =====");
		for(var mistake in mistakes){
			console.log(mistake,": ", mistakes[mistake].count, "mistakes ->", mistakes[mistake].fails.slice(0,5).join(', '), '...');
		}
	});
});





